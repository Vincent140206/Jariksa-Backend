const pool = require('../config/db');
const paymentService = require('./paymentService');

const createOrder = async (storeId, customerId, totalPrice, items, promoCode = null, paymentOption = 'NOW') => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const customerData = await client.query('SELECT * FROM customers WHERE id = $1', [customerId]);
        if (customerData.rows.length === 0) throw new Error('Customer not found');
        const customer = customerData.rows[0];

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
            customer: customer
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

const updateOrderStatus = async (orderId, storeId, newStatus) => {
    const query = `
        UPDATE orders 
        SET status = $1 
        WHERE id = $2 AND store_id = $3 
        RETURNING *
    `;
    const result = await pool.query(query, [newStatus, orderId, storeId]);

    if (result.rows.length === 0) {
        throw new Error('Order not found or you do not have permission to update it');
    }

    return result.rows[0];
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

module.exports = { createOrder, getOrdersByStoreId, getOrderDetails, updateOrderStatus, generatePaymentForExistingOrder };