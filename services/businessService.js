const pool = require('../config/db');

const addCategory = async (storeId, categoryName) => {
    const newCategory = await pool.query(
        'INSERT INTO categories (store_id, category_name) VALUES ($1, $2) RETURNING *',
        [storeId, categoryName]
    );
    return newCategory.rows[0];
};

const getCategories = async (storeId) => {
    const categories = await pool.query(
        'SELECT * FROM categories WHERE store_id = $1 ORDER BY id ASC',
        [storeId]
    );
    return categories.rows;
};

const addService = async (categoryId, serviceName, description, price, unit) => {
    const newService = await pool.query(
        'INSERT INTO services (category_id, service_name, description, price, unit) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [categoryId, serviceName, description, price, unit]
    );
    return newService.rows[0];
};

const getStoreMenu = async (storeId) => {
    const query = `
        SELECT 
            c.id AS category_id, 
            c.category_name,
            COALESCE(
                json_agg(
                    json_build_object(
                        'service_id', s.id,
                        'service_name', s.service_name,
                        'description', s.description,
                        'price', s.price,
                        'unit', s.unit
                    )
                ) FILTER (WHERE s.id IS NOT NULL), '[]'
            ) AS services
        FROM categories c
        LEFT JOIN services s ON c.id = s.category_id
        WHERE c.store_id = $1
        GROUP BY c.id, c.category_name
        ORDER BY c.id ASC;
    `;
    const menu = await pool.query(query, [storeId]);
    return menu.rows;
};

const fetchProfile = async (storeId) => {
    const query = `
        SELECT 
            s.id,
            s.store_name,
            s.email,
            s.profile_picture,
            s.created_at,
            
            COALESCE((
                SELECT SUM(total_price) 
                FROM orders 
                WHERE store_id = s.id 
                AND status NOT IN ('Canceled', 'Batal', 'Payment Failed')
            ), 0) AS total_omzet,

            COALESCE((
                SELECT COUNT(id) 
                FROM orders 
                WHERE store_id = s.id 
                AND status NOT IN ('Canceled', 'Batal', 'Payment Failed')
            ), 0) AS total_order

        FROM stores s
        WHERE s.id = $1
    `;

    const result = await pool.query(query, [storeId]);

    const profileData = result.rows[0];
    if (profileData) {
        profileData.total_omzet = parseInt(profileData.total_omzet);
        profileData.total_order = parseInt(profileData.total_order);
    }

    return profileData;
};

const updateStoreProfilePicture = async (storeId, imageUrl) => {
    const query = 'UPDATE stores SET profile_picture = $1 WHERE id = $2 RETURNING id, store_name, profile_picture';
    const result = await pool.query(query, [imageUrl, storeId]);
    return result.rows[0];
};

module.exports = { addCategory, getCategories, addService, getStoreMenu, fetchProfile, updateStoreProfilePicture };