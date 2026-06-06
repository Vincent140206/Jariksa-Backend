const pool = require('../config/db');

const getAllScans = async (req, res) => {
    try {
        const storeId = req.store.store_id;

        const query = `
            SELECT id, image_urls, ai_status, created_at 
            FROM scan_results 
            WHERE store_id = $1 
            ORDER BY created_at DESC
        `;
        const result = await pool.query(query, [storeId]);

        res.status(200).json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const getScanById = async (req, res) => {
    try {
        const storeId = req.store.store_id;
        const scanId = req.params.id;

        const query = `
            SELECT * FROM scan_results 
            WHERE id = $1 AND store_id = $2
        `;
        const result = await pool.query(query, [scanId, storeId]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Data scan tidak ditemukan atau Anda tidak memiliki akses.'
            });
        }

        res.status(200).json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = { getAllScans, getScanById };