const pool = require('../config/db');
const paymentService = require('./paymentService');
const { client } = require('../services/whatsappService');
const { validatePromoCode } = require('./promoService');

const createOrder = async (storeId, customerId, totalPrice, items, promoCode = null, paymentOption = 'NOW') => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const customerData = await client.query('SELECT * FROM customers WHERE id = $1', [customerId]);
        if (customerData.rows.length === 0) throw new Error('Customer not found');
        const customer = customerData.rows[0];

        const storeData = await client.query('SELECT store_name FROM stores WHERE id = $1', [storeId]);
        let storeName = 'JaRiksa';
        if (storeData.rows.length > 0) {
            storeName = storeData.rows[0].store_name;
        }

        let finalTotalPrice = totalPrice;
        let discountAmount = 0;
        let promoId = null;

        if (promoCode) {
            const promoData = await validatePromoCode(storeId, customerId, promoCode, totalPrice);
            promoId = promoData.promo_id;
            discountAmount = promoData.discount_amount;
            finalTotalPrice = promoData.final_total_price;
        }

        const initialStatus = paymentOption === 'NOW' ? 'Menunggu Pembayaran' : 'Diproses - Belum Dibayar';

        const mainItem = items[0];
        const etaData = await calculatePredictiveETA(storeId, mainItem.service_id, mainItem.quantity);

        const orderResult = await client.query(
            `INSERT INTO orders (store_id, customer_id, total_price, status, promo_id, discount_amount, estimated_completion) 
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [
                storeId,
                customerId,
                finalTotalPrice,
                initialStatus,
                promoId,
                discountAmount,
                etaData.estimated_completion_timestamp
            ]
        );
        const newOrder = orderResult.rows[0];

        const orderItems = [];
        for (const item of items) {
            let imageUrlsToSave = null;
            let aiStatusToSave = null;
            let aiReportToSave = null;

            if (item.scan_id) {
                const scanData = await client.query(
                    'SELECT image_urls, ai_status, ai_report FROM scan_results WHERE id = $1 AND store_id = $2',
                    [item.scan_id, storeId]
                );

                if (scanData.rows.length === 0) {
                    throw new Error(`Data scan AI tidak ditemukan atau tidak valid untuk scan_id: ${item.scan_id}`);
                }

                const scan = scanData.rows[0];
                imageUrlsToSave = JSON.stringify(scan.image_urls);
                aiStatusToSave = scan.ai_status;
                aiReportToSave = JSON.stringify(scan.ai_report);
            }

            const itemResult = await client.query(
                `INSERT INTO order_items (order_id, service_id, quantity, price, image_urls, ai_status, ai_report) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
                [
                    newOrder.id,
                    item.service_id,
                    item.quantity,
                    item.price,
                    imageUrlsToSave,
                    aiStatusToSave,
                    aiReportToSave
                ]
            );
            orderItems.push(itemResult.rows[0]);
        }

        if (promoId) {
            await client.query(
                'UPDATE promos SET is_used = true WHERE id = $1 AND customer_id IS NOT NULL',
                [promoId]
            );
        }

        let midtransResponse = null;
        if (paymentOption === 'NOW') {
            midtransResponse = await paymentService.createPaymentToken(
                newOrder.id,
                finalTotalPrice,
                customer.name,
                customer.phone_number
            );
        }

        await client.query('COMMIT');

        return {
            order: newOrder,
            items: orderItems,
            payment: midtransResponse,
            customer: customer,
            store_name: storeName
        };
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

const getOrdersByStoreId = async (storeId) => {
    const query = `
        SELECT 
            o.*, 
            c.name AS customer_name,
            c.phone_number AS customer_phone,
            COALESCE(
                json_agg(
                    json_build_object(
                        'item_id', oi.id,
                        'service_id', s.id,
                        'service_name', s.service_name, 
                        'category', cat.name,
                        'quantity', oi.quantity
                    )
                ) FILTER (WHERE oi.id IS NOT NULL), '[]'
            ) AS order_details
        FROM orders o
        LEFT JOIN customers c ON o.customer_id = c.id
        LEFT JOIN order_items oi ON o.id = oi.order_id
        LEFT JOIN services s ON oi.service_id = s.id
        LEFT JOIN categories cat ON s.category_id = cat.id
        WHERE o.store_id = $1 
        AND o.status NOT IN ('Dibatalkan', 'Canceled')
        GROUP BY o.id, c.id
        ORDER BY o.created_at DESC
    `;

    const result = await pool.query(query, [storeId]);
    return result.rows;
};

const getOrderDetails = async (orderId, storeId) => {
    const orderQuery = `
        SELECT o.*, c.name as customer_name, c.phone_number 
        FROM orders o
        JOIN customers c ON o.customer_id = c.id
        WHERE o.id = $1 AND o.store_id = $2
    `;
    const orderResult = await pool.query(orderQuery, [orderId, storeId]);

    if (orderResult.rows.length === 0) {
        throw new Error('Order not found or unauthorized');
    }

    const orderData = orderResult.rows[0];

    const itemsQuery = `
        SELECT oi.*, s.service_name 
        FROM order_items oi
        LEFT JOIN services s ON oi.service_id = s.id
        WHERE oi.order_id = $1
    `;
    const itemsResult = await pool.query(itemsQuery, [orderId]);

    return {
        ...orderData,
        items: itemsResult.rows
    };
};

const updateStatusAndNotify = async (orderId, newStatus, customMessage = null) => {
    const updateQuery = 'UPDATE orders SET status = $1 WHERE id = $2 RETURNING *';
    const orderResult = await pool.query(updateQuery, [newStatus, orderId]);

    if (orderResult.rowCount === 0) {
        throw new Error('Pesanan tidak ditemukan');
    }

    const customerQuery = `
        SELECT o.id as order_id, o.total_price, o.estimated_completion, c.name, c.phone_number, s.store_name 
        FROM orders o 
        JOIN customers c ON o.customer_id = c.id 
        JOIN stores s ON o.store_id = s.id
        WHERE o.id = $1
    `;
    const customerResult = await pool.query(customerQuery, [orderId]);
    const customer = customerResult.rows[0];

    let whatsappMessage = customMessage;

    if (!whatsappMessage) {
        const formattedPrice = Number(customer.total_price).toLocaleString('id-ID');

        const dateOptions = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
        const formattedETA = new Date(customer.estimated_completion).toLocaleDateString('id-ID', dateOptions);

        if (newStatus === 'Siap Diambil') {
            whatsappMessage = `Halo Kak ${customer.name},\n\nPesananmu dengan Order ID *#${orderId}* sudah SELESAI nih! ✨\nSilakan datang ke outlet untuk pengambilan ya.\n\nTotal Tagihan: *Rp ${formattedPrice}*\n\nTerima kasih telah menggunakan layanan dari *${customer.store_name}*! 📦`;

        } else if (newStatus === 'Terlambat') {
            whatsappMessage = `Halo Kak ${customer.name},\n\nKami memohon maaf, proses pengerjaan pesananmu dengan Order ID *#${orderId}* mengalami sedikit keterlambatan karena antrean yang cukup padat.\n\nKami akan berusaha menyelesaikannya secepat mungkin. Terima kasih atas pengertiannya. 🙏\n\nSalam hangat,\n*${customer.store_name}*`;

        } else if (newStatus === 'Selesai') {
            whatsappMessage = `Halo Kak ${customer.name},\n\nHore! Pesanan dengan Order ID *#${orderId}* sudah sukses diambil.\n\nTerima kasih banyak telah memercayakan barangmu kepada *${customer.store_name}*. Sampai jumpa kembali! 👋😊`;

        } else if (newStatus === 'Menunggu Pembayaran') {
            whatsappMessage = `*Halo Kak ${customer.name}!* 👋\n\nTerima kasih telah mempercayakan pesanan Anda kepada *${customer.store_name}*.\n\n*RINGKASAN PESANAN*\nNomor Pesanan: *#${orderId}*\nTotal Tagihan: *Rp ${formattedPrice}*\nStatus Bayar: *Belum Lunas*\nEstimasi Selesai: *${formattedETA}*.\n\nKami akan mengabari Anda kembali jika pesanan sudah siap.`;
        }
    }

    if (whatsappMessage && customer.phone_number) {
        try {
            let formattedPhone = String(customer.phone_number).replace(/[^0-9]/g, '');
            if (formattedPhone.startsWith('0')) {
                formattedPhone = '62' + formattedPhone.slice(1);
            }
            const whatsappId = `${formattedPhone}@c.us`;

            if (client) {
                await client.sendMessage(whatsappId, whatsappMessage);
                console.log(`WA Notifikasi sukses dikirim ke ${customer.name} (${newStatus})`);
            } else {
                console.error('FATAL: Objek client WA tidak ditemukan!');
            }
        } catch (waError) {
            console.error('Gagal mengirim WhatsApp:', waError.message);
        }
    }

    return orderResult.rows[0];
};

const generatePaymentForExistingOrder = async (orderId, storeId) => {
    const query = `
        SELECT o.*, c.name as customer_name, c.phone_number 
        FROM orders o
        JOIN customers c ON o.customer_id = c.id
        WHERE o.id = $1 AND o.store_id = $2
    `;
    const result = await pool.query(query, [orderId, storeId]);

    if (result.rows.length === 0) {
        throw new Error('Pesanan tidak ditemukan atau Anda tidak memiliki akses');
    }

    const order = result.rows[0];

    if (['Selesai', 'Paid', 'Completed'].includes(order.status)) {
        throw new Error('Pesanan ini sudah lunas atau selesai, tidak perlu bayar lagi.');
    }

    const midtransResponse = await paymentService.createPaymentToken(
        order.id,
        order.total_price,
        order.customer_name,
        order.phone_number
    );

    let nextStatus = order.status;
    if (order.status === 'Diproses - Belum Dibayar') {
        nextStatus = 'Menunggu Pembayaran';
    }

    await pool.query(
        'UPDATE orders SET status = $1 WHERE id = $2',
        [nextStatus, orderId]
    );

    return midtransResponse;
};

const updateOrderStatusFromMidtrans = async (orderId, transactionStatus) => {
    const orderData = await pool.query('SELECT status FROM orders WHERE id = $1', [orderId]);
    if (orderData.rows.length === 0) return null;

    const currentStatus = orderData.rows[0].status;
    let newStatus = '';

    if (transactionStatus === 'settlement' || transactionStatus === 'capture') {
        if (currentStatus === 'Siap Diambil') {
            newStatus = 'Selesai';
        } else {
            newStatus = 'Diproses';
        }
    }
    else if (transactionStatus === 'cancel' || transactionStatus === 'deny' || transactionStatus === 'expire') {
        newStatus = 'Dibatalkan';
    }
    else if (transactionStatus === 'pending') {
        if (currentStatus !== 'Siap Diambil') {
            newStatus = 'Menunggu Pembayaran';
        }
    }

    if (newStatus && newStatus !== currentStatus) {
        await pool.query('UPDATE orders SET status = $1 WHERE id = $2', [newStatus, orderId]);
        console.log(`Webhook: Order #${orderId} status diupdate dari ${currentStatus} jadi ${newStatus}`);
    }

    return newStatus || currentStatus;
};

const calculatePredictiveETA = async (storeId, serviceId, quantity) => {
    const storeRes = await pool.query(
        'SELECT operational_hours, total_staff FROM stores WHERE id = $1',
        [storeId]
    );
    const operationalHoursPerDay = storeRes.rows[0]?.operational_hours || 9;
    const totalStaff = storeRes.rows[0]?.total_staff || 1;

    const serviceRes = await pool.query(
        'SELECT duration_hours FROM services WHERE id = $1',
        [serviceId]
    );
    const serviceDuration = serviceRes.rows[0]?.duration_hours || 0;

    const baseSlaDays = Math.ceil(serviceDuration / 24);

    const WORK_HOURS_PER_ITEM = 1;
    const incomingWorkloadHours = parseFloat(quantity) * WORK_HOURS_PER_ITEM;

    const activeOrdersQuery = `
        SELECT COALESCE(SUM(oi.quantity), 0) as total_active_items 
        FROM orders o
        JOIN order_items oi ON o.id = oi.order_id
        WHERE o.store_id = $1 AND o.status IN ('Menunggu Validasi', 'Menunggu Pembayaran', 'Diproses')
    `;
    const activeOrdersRes = await pool.query(activeOrdersQuery, [storeId]);
    const activeItemsInQueue = parseFloat(activeOrdersRes.rows[0].total_active_items);

    const activeQueueWorkloadHours = activeItemsInQueue * WORK_HOURS_PER_ITEM;

    const dailyShopCapacity = operationalHoursPerDay * totalStaff;
    const totalWorkHoursRequired = incomingWorkloadHours + activeQueueWorkloadHours;

    const daysToClearWorkload = Math.ceil(totalWorkHoursRequired / dailyShopCapacity);

    const finalDaysRequired = Math.max(baseSlaDays, daysToClearWorkload);

    const estimatedCompletionDate = new Date();
    estimatedCompletionDate.setDate(estimatedCompletionDate.getDate() + finalDaysRequired);

    return {
        estimated_completion_timestamp: estimatedCompletionDate,
        formatted_eta: estimatedCompletionDate.toLocaleDateString('id-ID', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
        }),
        debug_info: {
            base_sla_days: baseSlaDays,
            queue_days: daysToClearWorkload,
            final_days_applied: finalDaysRequired,
            items_in_queue: activeItemsInQueue
        }
    };
};

module.exports = { createOrder, getOrdersByStoreId, getOrderDetails, updateStatusAndNotify, generatePaymentForExistingOrder, updateOrderStatusFromMidtrans, calculatePredictiveETA };