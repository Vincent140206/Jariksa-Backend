const customerService = require('../services/customerService');

const checkCustomer = async (req, res) => {
    try {
        const storeId = req.store.store_id;
        const { phone_number } = req.body;

        const customer = await customerService.findCustomerByPhone(storeId, phone_number);

        if (customer) {
            res.status(200).json({
                status: 'success',
                message: 'Customer found',
                data: customer
            });
        } else {
            res.status(404).json({
                status: 'not_found',
                message: 'Customer not found. Please register as new customer.'
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

        const newCustomer = await customerService.createCustomer(storeId, name, phone_number);
        res.status(201).json({
            status: 'success',
            message: 'Customer registered successfully',
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

module.exports = { checkCustomer, addCustomer, getCustomers, getCustomersDashboard, getCustomerDetails };