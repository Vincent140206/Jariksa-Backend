const pool = require('../config/db');
const paymentService = require('./paymentService');
const { client } = require('../services/whatsappService');

const createOrder = async (storeId, customerId, totalPrice, items, promoCode = null, paymentOption = 'NOW') => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const customerData = await client.query('SELECT * FROM customers WHERE id = $1', [customerId]);
        if (customerData.rows.length === 0) throw new Error('Customer not found');
        const customer = customerData.rows[0];

        const storeData = await client.query('SELECT name AS store_name FROM stores WHERE id = $1', [storeId]);
        let storeName = 'JaRiksa';
        if (storeData.rows.length > 0) {
            storeName = storeData.rows[0].store_name || storeData.rows[0].name;
        }

        let discountAmount = 0;
        let promoId = null;

        if (promoCode) {
            const promoResult = await client.query(
                'SELECT * FROM promos WHERE promo_code = $1 AND store_id = $2 AND is_active = true',
                [promoCode.trim().toUpperCase(), storeId]
            );

            if (promoResult.rows.length > 0) {
                const promo = promoResult.rows[0];
                let isEligible = false;

                if (promo.requirement_type === 'NONE') {
                    isEligible = true;
                } else if (promo.requirement_type === 'MIN_SPEND') {
                    if (totalPrice >= promo.requirement_value) isEligible = true;
                } else if (promo.requirement_type === 'MIN_ORDERS') {
                    const orderCountResult = await client.query(
                        `SELECT COUNT(*) FROM orders 
                         WHERE customer_id = $1 AND store_id = $2 
                         AND status NOT IN ('Payment Failed', 'Canceled')`,
                        [customerId, storeId]
                    );
                    const pastOrders = parseInt(orderCountResult.rows[0].count);
                    if (pastOrders >= promo.requirement_value) isEligible = true;
                }

                if (isEligible) {
                    promoId = promo.id;
                    if (promo.reward_type === 'FIXED') {
                        discountAmount = promo.reward_value;
                    } else if (promo.reward_type === 'PERCENT') {
                        discountAmount = (totalPrice * promo.reward_value) / 100;
                        if (promo.max_discount && discountAmount > promo.max_discount) {
                            discountAmount = promo.max_discount;
                        }
                    } else if (promo.reward_type === 'FREE_SERVICE') {
                        const matchingItem = items.find(item => parseInt(item.service_id) === promo.free_service_id);
                        if (matchingItem) {
                            discountAmount = matchingItem.price;
                        }
                    }
                }
            }
        }

        const finalTotalPrice = Math.max(0, totalPrice - discountAmount);

        const initialStatus = paymentOption === 'NOW' ? 'Pending Payment' : 'Processing - Unpaid';

        const orderResult = await client.query(
            `INSERT INTO orders (store_id, customer_id, total_price, status, promo_id, discount_amount, estimated_completion) 
             VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP + INTERVAL '3 days') RETURNING *`,
            [storeId, customerId, finalTotalPrice, initialStatus, promoId, discountAmount]
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
        SELECT o.*, c.name as customer_name, c.phone_number 
        FROM orders o
        JOIN customers c ON o.customer_id = c.id
        WHERE o.store_id = $1
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
        SELECT o.id as order_id, o.total_price, c.name, c.phone_number, s.store_name 
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

        if (newStatus === 'Ready for Pickup') {
            whatsappMessage = `Halo Kak ${customer.name},\n\nPesananmu dengan Order ID *#${orderId}* sudah SELESAI nih! ✨\nSilakan datang ke outlet untuk pengambilan ya.\n\nTotal Tagihan: *Rp ${formattedPrice}*\n\nTerima kasih telah menggunakan layanan dari *${customer.store_name}*! 📦`;

        } else if (newStatus === 'Delayed') {
            whatsappMessage = `Halo Kak ${customer.name},\n\nKami memohon maaf, proses pengerjaan pesananmu dengan Order ID *#${orderId}* mengalami sedikit keterlambatan karena antrean yang cukup padat.\n\nKami akan berusaha menyelesaikannya secepat mungkin. Terima kasih atas pengertiannya. 🙏\n\nSalam hangat,\n*${customer.store_name}*`;

        } else if (newStatus === 'Completed') {
            whatsappMessage = `Halo Kak ${customer.name},\n\nHore! Pesanan dengan Order ID *#${orderId}* sudah sukses diambil.\n\nTerima kasih banyak telah memercayakan barangmu kepada *${customer.store_name}*. Sampai jumpa kembali! 👋😊`;

        } else if (newStatus === 'Pending Payment') {
            whatsappMessage = `*Halo Kak ${customer.name}!* 👋\n\nTerima kasih telah mempercayakan pesanan Anda kepada *${customer.store_name}*.\n\n*RINGKASAN PESANAN*\nNomor Pesanan: *#${orderId}*\nTotal Tagihan: *Rp ${formattedPrice}*\nStatus Bayar: *Belum Lunas*\nEstimasi Selesai: 3 Hari dari sekarang.\n\nKami akan mengabari Anda kembali jika pesanan sudah siap.`;
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

    if (['Paid', 'Completed'].includes(order.status)) {
        throw new Error('Pesanan ini sudah lunas, tidak perlu bayar lagi.');
    }

    const midtransResponse = await paymentService.createPaymentToken(
        order.id,
        order.total_price,
        order.customer_name,
        order.phone_number
    );

    await pool.query(
        'UPDATE orders SET status = $1 WHERE id = $2',
        ['Pending Payment', orderId]
    );

    return midtransResponse;
};

const updateOrderStatusFromMidtrans = async (orderId, transactionStatus) => {
    let newStatus = '';

    if (transactionStatus === 'settlement' || transactionStatus === 'capture') {
        newStatus = 'Processing';
    }
    else if (transactionStatus === 'cancel' || transactionStatus === 'deny' || transactionStatus === 'expire') {
        newStatus = 'Canceled';
    }
    else if (transactionStatus === 'pending') {
        newStatus = 'Pending Payment';
    }

    if (newStatus) {
        await pool.query('UPDATE orders SET status = $1 WHERE id = $2', [newStatus, orderId]);
        console.log(`Webhook: Order #${orderId} status diupdate jadi ${newStatus}`);
    }

    return newStatus;
};

module.exports = { createOrder, getOrdersByStoreId, getOrderDetails, updateStatusAndNotify, generatePaymentForExistingOrder, updateOrderStatusFromMidtrans };