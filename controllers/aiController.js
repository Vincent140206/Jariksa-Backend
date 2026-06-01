const visionService = require('../services/visionService');
const storageService = require('../services/storageService');

const scanItem = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ status: 'error', message: 'Tidak ada foto yang diunggah' });
        }

        const fileBuffer = req.file.buffer;
        const gcsData = await storageService.uploadFileToGCS(
            fileBuffer,
            req.file.originalname,
            req.file.mimetype
        );

        const detectionResults = await visionService.analyzeImage(gcsData.gsUri);

        res.status(200).json({
            status: 'success',
            message: 'AI analysis & GCS upload completed successfully',
            image_url: gcsData.publicUrl,
            data: detectionResults
        });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
};

module.exports = { scanItem };