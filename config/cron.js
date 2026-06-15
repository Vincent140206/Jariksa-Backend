const cron = require('node-cron');
const pool = require('./db');

const cronOptions = {
    scheduled: true,
    timezone: "Asia/Jakarta"
};

cron.schedule('0 * * * *', async () => {
    console.log('[CRON] Memeriksa pesanan yang melewati estimasi selesai...');
    try {
        const query = `
            UPDATE orders 
            SET status = 'Terlambat' 
            WHERE status IN ('Diproses', 'Diproses - Belum Dibayar')
            AND estimated_completion < CURRENT_TIMESTAMP;
        `;
        const result = await pool.query(query);
        if (result.rowCount > 0) {
            console.log(`[CRON] Sukses! ${result.rowCount} pesanan diubah menjadi 'Terlambat'.`);
        }
    } catch (error) {
        console.error('[CRON] Gagal memicu status terlambat:', error.message);
    }
}, cronOptions);

cron.schedule('0 0 * * *', async () => {
    console.log('[CRON] Mengecek dan memperbarui status customer yang Hilang...');
    try {
        const query = `
            UPDATE customers c
            SET loyalty_status = 'Hilang'
            WHERE c.loyalty_status IN ('Setia', 'Baru')
            AND (
                SELECT MAX(created_at) 
                FROM orders 
                WHERE customer_id = c.id
            ) < CURRENT_TIMESTAMP - INTERVAL '60 days';
        `;
        const result = await pool.query(query);
        if (result.rowCount > 0) {
            console.log(`[CRON] Sukses! ${result.rowCount} customer diubah menjadi 'Hilang'.`);
        }
    } catch (error) {
        console.error('[CRON] Gagal update status hilang:', error.message);
    }
}, cronOptions);