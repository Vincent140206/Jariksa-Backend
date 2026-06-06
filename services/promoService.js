const pool = require('../config/db');

const createNewPromo = async (storeId, promoData) => {
    const {
        promo_name, promo_code, description,
        requirement_type, requirement_value,
        reward_type, reward_value, free_service_id, max_discount
    } = promoData;

    const cleanCode = promo_code.trim().toUpperCase();

    const query = `
        INSERT INTO promos (
            store_id, promo_name, promo_code, description, 
            requirement_type, requirement_value, reward_type, 
            reward_value, free_service_id, max_discount
        ) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
        RETURNING *
    `;

    const values = [
        storeId, promo_name, cleanCode, description,
        requirement_type, requirement_value || 0, reward_type,
        reward_value || 0, free_service_id || null, max_discount || null
    ];

    try {
        const result = await pool.query(query, values);
        return result.rows[0];
    } catch (error) {
        if (error.code === '23505') {
            throw new Error('Kode promo ini sudah pernah kamu buat. Gunakan kode lain.');
        }
        throw error;
    }
};

const getPromosByStore = async (storeId) => {
    const query = `
        SELECT p.*, s.service_name AS free_service_name 
        FROM promos p
        LEFT JOIN services s ON p.free_service_id = s.id
        WHERE p.store_id = $1
        ORDER BY p.created_at DESC
    `;
    const result = await pool.query(query, [storeId]);
    return result.rows;
};

const togglePromoStatus = async (promoId, storeId, isActive) => {
    const query = `
        UPDATE promos 
        SET is_active = $1 
        WHERE id = $2 AND store_id = $3 
        RETURNING *
    `;
    const result = await pool.query(query, [isActive, promoId, storeId]);

    if (result.rows.length === 0) {
        throw new Error('Promo tidak ditemukan atau kamu tidak memiliki akses.');
    }
    return result.rows[0];
};

module.exports = { createNewPromo, getPromosByStore, togglePromoStatus };