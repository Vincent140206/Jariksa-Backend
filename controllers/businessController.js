const businessService = require('../services/businessService');
const { uploadToGCS } = require('../services/visionService');

const createCategory = async (req, res) => {
    try {
        const storeId = req.store.store_id;
        const { category_name } = req.body;

        const result = await businessService.addCategory(storeId, category_name);
        res.status(201).json({ status: 'success', message: 'Category added', data: result });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
};

const createService = async (req, res) => {
    try {
        const { category_id, service_name, description, price, unit } = req.body;

        const result = await businessService.addService(category_id, service_name, description, price, unit);
        res.status(201).json({ status: 'success', message: 'Service added', data: result });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
};

const fetchMenu = async (req, res) => {
    try {
        const storeId = req.store.store_id;
        const result = await businessService.getStoreMenu(storeId);

        res.status(200).json({ status: 'success', data: result });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
};

const fetchProfile = async (req, res) => {
    try {
        const storeId = req.store.store_id;
        const result = await businessService.fetchProfile(storeId);

        res.status(200).json({ status: 'success', data: result });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
}

const uploadStorePicture = async (req, res) => {
    try {
        const storeId = req.store.store_id;

        if (!req.file) {
            return res.status(400).json({ status: 'error', message: 'Silakan pilih file foto.' });
        }

        const uploadResult = await uploadToGCS(req.file.buffer, req.file.originalname);

        const updatedStore = await businessService.updateStoreProfilePicture(storeId, uploadResult.publicUrl);

        res.status(200).json({
            status: 'success',
            message: 'Foto profil diperbarui.',
            data: updatedStore
        });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
};

module.exports = { createCategory, createService, fetchMenu, fetchProfile, uploadStorePicture };