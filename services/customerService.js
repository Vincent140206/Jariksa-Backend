const pool = require('../config/db');

const findCustomerByPhone = async (storeId, phoneNumber) => {
    const customer = await pool.query(
        'SELECT * FROM customers WHERE store_id = $1 AND phone_number = $2',
        [storeId, phoneNumber]
    );
    return customer.rows[0];
};

const createCustomer = async (storeId, name, phoneNumber) => {
    const existingCustomer = await findCustomerByPhone(storeId, phoneNumber);
    if (existingCustomer) {
        throw new Error('Customer with this phone number already exists');
    }

    const newCustomer = await pool.query(
        'INSERT INTO customers (store_id, name, phone_number) VALUES ($1, $2, $3) RETURNING *',
        [storeId, name, phoneNumber]
    );
    return newCustomer.rows[0];
};

const getAllStoreCustomers = async (storeId) => {
    const customers = await pool.query(
        'SELECT * FROM customers WHERE store_id = $1 ORDER BY created_at DESC',
        [storeId]
    );
    return customers.rows;
};

const getCustomersList = async (storeId, search = '', filter = 'Semua') => {
    let query = `
        WITH customer_stats AS (
            SELECT 
                c.id,
                c.name,
                c.phone_number,
                COUNT(o.id) as total_visits,
                MAX(o.created_at) as last_visit,
                CASE 
                    WHEN COUNT(o.id) >= 15 THEN 'Setia'
                    WHEN MAX(o.created_at) < CURRENT_DATE - INTERVAL '30 days' THEN 'Hilang'
                    ELSE 'Baru'
                END as status
            FROM customers c
            LEFT JOIN orders o ON o.customer_id = c.id AND o.store_id = $1
            WHERE c.store_id = $1
            GROUP BY c.id, c.name, c.phone_number
        )
        SELECT * FROM customer_stats
        WHERE 1=1
    `;

    const params = [storeId];
    let paramIndex = 2;

    if (search) {
        query += ` AND (name ILIKE $${paramIndex} OR phone_number ILIKE $${paramIndex})`;
        params.push(`%${search}%`);
        paramIndex++;
    }

    if (filter && filter !== 'Semua') {
        query += ` AND status = $${paramIndex}`;
        params.push(filter);
        paramIndex++;
    }

    query += ` ORDER BY last_visit DESC NULLS LAST`;

    const listResult = await pool.query(query, params);

    const summaryQuery = `
        WITH customer_stats AS (
            SELECT 
                c.id,
                COUNT(o.id) as total_visits,
                MAX(o.created_at) as last_visit,
                CASE 
                    WHEN COUNT(o.id) >= 15 THEN 'Setia'
                    WHEN MAX(o.created_at) < CURRENT_DATE - INTERVAL '30 days' THEN 'Hilang'
                    ELSE 'Baru'
                END as status
            FROM customers c
            LEFT JOIN orders o ON o.customer_id = c.id AND o.store_id = $1
            WHERE c.store_id = $1
            GROUP BY c.id
        )
        SELECT 
            COUNT(*) as total_pelanggan,
            COUNT(CASE WHEN status = 'Setia' THEN 1 END) as pelanggan_setia,
            COUNT(CASE WHEN status = 'Hilang' THEN 1 END) as pelanggan_hilang
        FROM customer_stats
    `;
    const summaryResult = await pool.query(summaryQuery, [storeId]);
    const summary = summaryResult.rows[0];

    return {
        summary: {
            total_pelanggan: parseInt(summary.total_pelanggan || 0),
            pelanggan_setia: parseInt(summary.pelanggan_setia || 0),
            pelanggan_hilang: parseInt(summary.pelanggan_hilang || 0)
        },
        customers: listResult.rows
    };
};

const getCustomerProfileDetails = async (storeId, customerId) => {
    const profileQuery = `
        SELECT 
            c.id, c.name, c.phone_number,
            COUNT(o.id) as total_kunjungan,
            COALESCE(SUM(CASE WHEN o.status NOT IN ('Payment Failed', 'Dibatalkan') THEN o.total_price ELSE 0 END), 0) as total_pengeluaran,
            EXTRACT(DAY FROM NOW() - MAX(o.created_at)) as terakhir_datang_hari_lalu,
            CASE 
                WHEN COUNT(o.id) >= 15 THEN 'Setia'
                WHEN MAX(o.created_at) < CURRENT_DATE - INTERVAL '30 days' THEN 'Hilang'
                ELSE 'Baru'
            END as status
        FROM customers c
        LEFT JOIN orders o ON o.customer_id = c.id AND o.store_id = $1
        WHERE c.store_id = $1 AND c.id = $2
        GROUP BY c.id, c.name, c.phone_number
    `;
    const profileResult = await pool.query(profileQuery, [storeId, customerId]);

    if (profileResult.rows.length === 0) {
        throw new Error('Pelanggan tidak ditemukan');
    }

    const chartQuery = `
        SELECT 
            TO_CHAR(created_at, 'Mon') as month,
            COUNT(*) as count,
            DATE_TRUNC('month', created_at) as month_order
        FROM orders
        WHERE store_id = $1 AND customer_id = $2 AND created_at >= CURRENT_DATE - INTERVAL '6 months'
        GROUP BY TO_CHAR(created_at, 'Mon'), DATE_TRUNC('month', created_at)
        ORDER BY month_order ASC
    `;
    const chartResult = await pool.query(chartQuery, [storeId, customerId]);

    const historyQuery = `
        SELECT o.id, o.total_price, o.status, o.created_at,
               (SELECT s.service_name FROM order_items oi JOIN services s ON oi.service_id = s.id WHERE oi.order_id = o.id LIMIT 1) as main_service
        FROM orders o
        WHERE o.store_id = $1 AND o.customer_id = $2
        ORDER BY o.created_at DESC
    `;
    const historyResult = await pool.query(historyQuery, [storeId, customerId]);

    return {
        profile: profileResult.rows[0],
        visit_frequency_chart: chartResult.rows.map(row => ({ month: row.month, total_orders: parseInt(row.count) })),
        order_history: historyResult.rows
    };
};

module.exports = { findCustomerByPhone, createCustomer, getAllStoreCustomers, getCustomersList, getCustomerProfileDetails };