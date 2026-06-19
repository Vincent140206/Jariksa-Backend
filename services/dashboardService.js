const pool = require('../config/db');

const getDashboardData = async (storeId) => {
    const incomeQuery = `
        SELECT 
            COALESCE(SUM(CASE WHEN DATE(created_at) = CURRENT_DATE THEN total_price ELSE 0 END), 0) AS today_income,
            COALESCE(SUM(CASE WHEN DATE(created_at) = CURRENT_DATE - INTERVAL '1 day' THEN total_price ELSE 0 END), 0) AS yesterday_income
        FROM orders 
        WHERE store_id = $1 AND status NOT IN ('Dibatalkan')
    `;
    const incomeResult = await pool.query(incomeQuery, [storeId]);
    const { today_income, yesterday_income } = incomeResult.rows[0];

    let incomeTrend = 0;
    if (yesterday_income > 0) {
        incomeTrend = Math.round(((today_income - yesterday_income) / yesterday_income) * 100);
    } else if (today_income > 0) {
        incomeTrend = 100;
    }

    const statusQuery = `
        SELECT status, COUNT(*) as count 
        FROM orders 
        WHERE store_id = $1 AND status NOT IN ('Dibatalkan')
        GROUP BY status
    `;
    const statusResult = await pool.query(statusQuery, [storeId]);

    let operasional = { masuk: 0, diproses: 0, selesai: 0 };

    statusResult.rows.forEach(row => {
        const count = parseInt(row.count);

        switch (row.status) {
            case 'Menunggu Pembayaran':
                operasional.masuk += count;
                break;

            case 'Diproses':
            case 'Diproses - Belum Dibayar':
            case 'Terlambat':
                operasional.diproses += count;
                break;

            case 'Siap Diambil':
            case 'Selesai':
                operasional.selesai += count;
                break;

            default:
                break;
        }
    });

    const lateQuery = `
        SELECT COUNT(*) as count 
        FROM orders 
        WHERE store_id = $1 
        AND status IN ('Diproses', 'Diproses - Belum Dibayar', 'Menunggu Pembayaran', 'Terlambat')
        AND estimated_completion < CURRENT_TIMESTAMP
    `;
    const lateResult = await pool.query(lateQuery, [storeId]);
    const lateCount = parseInt(lateResult.rows[0].count);

    const recentQuery = `
        SELECT o.id, 
            o.status, 
            o.created_at, 
            c.name as customer_name,
            s.service_name as main_service,
            cat.category_name as category
        FROM orders o
        JOIN customers c ON o.customer_id = c.id
        LEFT JOIN order_items oi ON oi.order_id = o.id
        LEFT JOIN services s ON oi.service_id = s.id
        LEFT JOIN categories cat ON s.category_id = cat.id
        WHERE o.store_id = $1
        GROUP BY o.id, c.name, s.service_name, cat.category_name
        ORDER BY o.created_at DESC
        LIMIT 5
    `;
    const recentResult = await pool.query(recentQuery, [storeId]);

    return {
        income: {
            today: parseInt(today_income),
            trend_percentage: incomeTrend,
            is_up: incomeTrend >= 0
        },
        operational_status: operasional,
        late_orders: {
            count: lateCount,
            has_late: lateCount > 0,
            message: lateCount > 0 ? `Ada ${lateCount} pesanan melewati estimasi waktu` : 'Semua pesanan berjalan tepat waktu'
        },
        recent_activities: recentResult.rows
    };
};

module.exports = { getDashboardData };