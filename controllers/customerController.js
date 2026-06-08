const customerService = require('../services/customerService');

const formatPhoneNumber = (phone) => {
    if (!phone) return null;
    let cleanNumber = phone.replace(/\D/g, '');
    if (cleanNumber.startsWith('62')) {
        cleanNumber = '0' + cleanNumber.slice(2);
    }
    return cleanNumber;
};

const checkCustomer = async (req, res) => {
    try {
        const storeId = req.store.store_id;
        const { phone_number } = req.body;

        if (!phone_number) {
            return res.status(400).json({ status: 'error', message: 'Nomor HP wajib diisi' });
        }

        const cleanNumber = formatPhoneNumber(phone_number);
        const customer = await customerService.findCustomerByPhone(storeId, cleanNumber);

        if (customer) {
            return res.status(200).json({
                status: 'success',
                message: 'Customer ditemukan',
                data: customer
            });
        } else {
            return res.status(404).json({
                status: 'not_found',
                message: 'Customer belum terdaftar.',
                formatted_phone: cleanNumber
            });
        }
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
};

const addCustomer = async (req, res) => {
    try {
        const storeId = req.store.store_id;
        const { name, phone_number } = req.body;

        if (!name || !phone_number) {
            return res.status(400).json({ status: 'error', message: 'Nama dan Nomor HP wajib diisi' });
        }

        const cleanNumber = formatPhoneNumber(phone_number);

        const newCustomer = await customerService.createCustomer(storeId, name, cleanNumber);

        res.status(201).json({
            status: 'success',
            message: 'Customer berhasil didaftarkan',
            data: newCustomer
        });
    } catch (error) {
        res.status(400).json({ status: 'error', message: error.message });
    }
};

const getCustomers = async (req, res) => {
    try {
        const storeId = req.store.store_id;
        const customers = await customerService.getAllStoreCustomers(storeId);

        res.status(200).json({ status: 'success', data: customers });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
};

const getCustomersDashboard = async (req, res) => {
    try {
        const storeId = req.store.store_id;
        const { search, filter } = req.query;

        const data = await customerService.getCustomersList(storeId, search, filter);

        res.status(200).json({
            status: 'success',
            data: data
        });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
};

const getCustomerDetails = async (req, res) => {
    try {
        const storeId = req.store.store_id;
        const customerId = req.params.id;

        const data = await customerService.getCustomerProfileDetails(storeId, customerId);

        res.status(200).json({
            status: 'success',
            data: data
        });
    } catch (error) {
        const statusCode = error.message.includes('tidak ditemukan') ? 404 : 500;
        res.status(statusCode).json({ status: 'error', message: error.message });
    }
};

module.exports = { formatPhoneNumber, checkCustomer, addCustomer, getCustomers, getCustomersDashboard, getCustomerDetails };