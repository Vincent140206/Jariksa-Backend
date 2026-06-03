const pool = require('../config/db');
const paymentService = require('./paymentService');

const createOrder = async (storeId, customerId, totalPrice, items) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const customerData = await client.query('SELECT * FROM customers WHERE id = $1', [customerId]);
        if (customerData.rows.length === 0) throw new Error('Customer not found');
        const customer = customerData.rows[0];

        const orderResult = await client.query(
            'INSERT INTO orders (store_id, customer_id, total_price, status) VALUES ($1, $2, $3, $4) RETURNING *',
            [storeId, customerId, totalPrice, 'Pending Payment']
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
            totalPrice,
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