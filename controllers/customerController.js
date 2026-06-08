const customerService = require('../services/customerService');

const checkOrAddCustomer = async (req, res) => {
    try {
        const storeId = req.store.store_id;
        const { name, phone_number } = req.body;

        if (!phone_number) {
            return res.status(400).json({
                status: 'error',
                message: 'Nomor HP wajib diisi'
            });
        }

        let cleanNumber = phone_number.replace(/\D/g, '');

        if (cleanNumber.startsWith('62')) {
            cleanNumber = '0' + cleanNumber.slice(2);
        }

        let customer = await customerService.findCustomerByPhone(storeId, cleanNumber);

        if (customer) {
            return res.status(200).json({
                status: 'success',
                message: 'Customer found',
                data: customer
            });
        } else {
            const customerName = name || 'Pelanggan Baru';

            customer = await customerService.createCustomer(storeId, customerName, cleanNumber);

            return res.status(201).json({
                status: 'success',
                message: 'Customer auto-registered successfully',
                data: customer
            });
        }
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
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

module.exports = { checkOrAddCustomer, getCustomers, getCustomersDashboard, getCustomerDetails };