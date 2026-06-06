const pool = require('../config/db');
const paymentService = require('./paymentService');

const createOrder = async (storeId, customerId, totalPrice, items, promoCode = null) => {
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

        const orderResult = await client.query(
            `INSERT INTO orders (store_id, customer_id, total_price, status, promo_id, discount_amount) 
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [storeId, customerId, finalTotalPrice, 'Pending Payment', promoId, discountAmount]
        );
        const newOrder = orderResult.rows[0];

        const orderItems = [];
        for (const item of items) {
            const itemResult = await client.query(
                `INSERT INTO order_items (order_id, service_id, quantity, price, image_url, ai_status, ai_report) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
                [newOrder.id, item.service_id, item.quantity, item.price, item.image_url, item.ai_status, item.ai_report]
            );
            orderItems.push(itemResult.rows[0]);
        }

        const midtransResponse = await paymentService.createPaymentToken(
            newOrder.id,
            finalTotalPrice,
            customer.name,
            customer.phone_number
        );

        await client.query('COMMIT');

        return {
            order: newOrder,
            items: orderItems,
            payment: midtransResponse
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

module.exports = { createOrder, getOrdersByStoreId, getOrderDetails };