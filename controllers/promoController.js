const promoService = require('../services/promoService');
const whatsappService = require('../services/whatsappService');
const pool = require('../config/db');

const addPromo = async (req, res) => {
    try {
        const storeId = req.store.store_id;
        const promoData = req.body;

        if (!promoData.promo_name || !promoData.promo_code || !promoData.requirement_type || !promoData.reward_type) {
            return res.status(400).json({ status: 'error', message: 'Data promo tidak lengkap!' });
        }

        const newPromo = await promoService.createNewPromo(storeId, promoData);

        res.status(201).json({ status: 'success', message: 'Promo universal berhasil dibuat!', data: newPromo });
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

const validatePromo = async (req, res) => {
    try {
        const storeId = req.store.store_id;
        const { customer_id, promo_code, total_price } = req.body;

        if (!customer_id || !promo_code || !total_price) {
            return res.status(400).json({
                status: 'error',
                message: 'customer_id, promo_code, dan total_price wajib diisi!'
            });
        }

        const validPromoData = await promoService.validatePromoCode(storeId, customer_id, promo_code, total_price);

        res.status(200).json({
            status: 'success',
            message: 'Kode promo berhasil diterapkan!',
            data: validPromoData
        });
    } catch (error) {
        res.status(400).json({ status: 'error', message: error.message });
    }
};

const sendTargetedPromo = async (req, res) => {
    try {
        const storeId = req.store.store_id;
        const { customer_id, reward_value } = req.body;

        if (!customer_id || !reward_value) {
            return res.status(400).json({
                status: 'error',
                message: 'ID pelanggan dan nominal diskon wajib diisi!'
            });
        }

        const customerQuery = 'SELECT name, phone_number FROM customers WHERE id = $1';
        const customerResult = await pool.query(customerQuery, [customer_id]);

        if (customerResult.rows.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'Data pelanggan tidak ditemukan di database!'
            });
        }

        const customerName = customerResult.rows[0].name;
        const customerPhone = customerResult.rows[0].phone_number;

        if (!customerPhone) {
            return res.status(400).json({
                status: 'error',
                message: 'Pelanggan ini tidak memiliki nomor HP yang terdaftar.'
            });
        }

        const newPromo = await promoService.generateTargetedPromo(storeId, customer_id, customerName, reward_value);

        const waMessage = `Halo kak ${customerName}!\n\nKami kangen kakak memakai jasa di toko kami. Ini ada diskon spesial Rp${reward_value.toLocaleString('id-ID')} khusus buat kakak.\n\nGunakan kode promo: *${newPromo.promo_code}*\n\nKode ini cuma bisa dipakai 1x ya kak. Ditunggu kedatangannya!`;

        await whatsappService.sendPlainMessage(customerPhone, waMessage);

        res.status(201).json({
            status: 'success',
            message: `Promo eksklusif berhasil dibuat dan dikirim ke ${customerName}!`,
            data: newPromo
        });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
};

module.exports = { addPromo, getMyPromos, updatePromoStatus, validatePromo, sendTargetedPromo };