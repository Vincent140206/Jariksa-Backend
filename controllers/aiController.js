const multer = require('multer');
const visionService = require('../services/visionService');
const pool = require('../config/db');

const scanItem = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'Tidak ada foto yang dikirim. Gunakan key "image" dengan tipe File.',
            });
        }

        const result = await visionService.analyzeAndUploadImages([req.file]);

        const itemData = result.results[0];

        const imageUrls = [itemData.public_url];
        const aiStatus = itemData.item_status;
        const storeId = req.store.store_id;

        const insertQuery = `
            INSERT INTO scan_results (store_id, image_urls, ai_status, ai_report)
            VALUES ($1, $2, $3, $4) RETURNING id
        `;
        const dbResult = await pool.query(insertQuery, [
            storeId,
            JSON.stringify(imageUrls),
            aiStatus,
            JSON.stringify(itemData)
        ]);

        const scanId = dbResult.rows[0].id;

        return res.status(200).json({
            success: true,
            scan_id: scanId,
            ...itemData,
        });

    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

const scanItems = async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Tidak ada foto yang dikirim. Gunakan key "images" dengan tipe File.',
            });
        }

        const { results, summary } = await visionService.analyzeAndUploadImages(req.files);

        const storeId = req.store.store_id;

        const imageUrls = results.map(item => item.public_url);

        const overallStatus = summary.damaged > 0 ? 'DAMAGED' : 'SAFE';

        const aiReport = { summary, results };

        const insertQuery = `
            INSERT INTO scan_results (store_id, image_urls, ai_status, ai_report)
            VALUES ($1, $2, $3, $4) RETURNING id
        `;
        const dbResult = await pool.query(insertQuery, [
            storeId,
            JSON.stringify(imageUrls),
            overallStatus,
            JSON.stringify(aiReport)
        ]);

        const scanId = dbResult.rows[0].id;

        return res.status(200).json({
            success: true,
            scan_id: scanId,
            summary,
            results,
        });

    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

const handleUploadError = (err, req, res, next) => {
    if (err instanceof multer.MulterError || err.message) {
        return res.status(400).json({ success: false, message: err.message });
    }
    next(err);
};

module.exports = { scanItem, scanItems, handleUploadError };