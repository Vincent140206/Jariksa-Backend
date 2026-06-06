const promoService = require('../services/promoService');

const addPromo = async (req, res) => {
    try {
        const storeId = req.store.store_id;
        const promoData = req.body;

        if (!promoData.promo_name || !promoData.promo_code || !promoData.requirement_type || !promoData.reward_type) {
            return res.status(400).json({ status: 'error', message: 'Data promo tidak lengkap!' });
        }

        const newPromo = await promoService.createNewPromo(storeId, promoData);

        res.status(201).json({ status: 'success', message: 'Promo berhasil dibuat!', data: newPromo });
    } catch (error) {
        res.status(400).json({ status: 'error', message: error.message });
    }
};

const getMyPromos = async (req, res) => {
    try {
        const storeId = req.store.store_id;
        const promos = await promoService.getPromosByStore(storeId);

        res.status(200).json({ status: 'success', data: promos });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
};

const updatePromoStatus = async (req, res) => {
    try {
        const storeId = req.store.store_id;
        const promoId = req.params.id;
        const { is_active } = req.body;

        const updatedPromo = await promoService.togglePromoStatus(promoId, storeId, is_active);

        res.status(200).json({ status: 'success', message: 'Status promo diubah!', data: updatedPromo });
    } catch (error) {
        res.status(400).json({ status: 'error', message: error.message });
    }
};

module.exports = { addPromo, getMyPromos, updatePromoStatus };