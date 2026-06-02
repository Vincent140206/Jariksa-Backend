const pool = require('../config/db');

const findCustomerByPhone = async (storeId, phoneNumber) => {
    const customer = await pool.query(
        'SELECT * FROM customers WHERE store_id = $1 AND phone_number = $2',
        [storeId, phoneNumber]
    );
    return customer.rows[0];
};

const createCustomer = async (storeId, name, phoneNumber) => {
    const existingCustomer = await findCustomerByPhone(storeId, phoneNumber);
    if (existingCustomer) {
        throw new Error('Customer with this phone number already exists');
    }

    const newCustomer = await pool.query(
        'INSERT INTO customers (store_id, name, phone_number) VALUES ($1, $2, $3) RETURNING *',
        [storeId, name, phoneNumber]
    );
    return newCustomer.rows[0];
};

const getAllStoreCustomers = async (storeId) => {
    const customers = await pool.query(
        'SELECT * FROM customers WHERE store_id = $1 ORDER BY created_at DESC',
        [storeId]
    );
    return customers.rows;
};

module.exports = { findCustomerByPhone, createCustomer, getAllStoreCustomers };