const visionService = require('../services/visionService');

const scanItem = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ status: 'error', message: 'No image file uploaded' });
        }

        const filePath = req.file.path;

        const detectionResults = await visionService.analyzeImage(filePath);

        res.status(200).json({
            status: 'success',
            message: 'AI analysis completed successfully',
            data: detectionResults
        });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
};

module.exports = { scanItem };