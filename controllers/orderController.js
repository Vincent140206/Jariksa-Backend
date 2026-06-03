const orderService = require('../services/orderService');

const createNewOrder = async (req, res) => {
    try {
        const storeId = req.store.store_id;
        const { customer_id, total_price, items } = req.body;

        if (!customer_id || !items || items.length === 0) {
            return res.status(400).json({
                status: 'error',
                message: 'Customer ID and at least one item are required'
            });
        }

        const result = await orderService.createOrder(storeId, customer_id, total_price, items);

        res.status(201).json({
            status: 'success',
            message: 'Order created successfully',
            data: result
        });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
};

const getAllOrders = async (req, res) => {
    try {
        const storeId = req.store.store_id;
        const orders = await orderService.getOrdersByStoreId(storeId);

        res.status(200).json({
            status: 'success',
            data: orders
        });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
};

const getOrderById = async (req, res) => {
    try {
        const storeId = req.store.store_id;
        const orderId = req.params.id;

        const orderDetails = await orderService.getOrderDetails(orderId, storeId);

        res.status(200).json({
            status: 'success',
            data: orderDetails
        });
    } catch (error) {
        if (error.message.includes('not found')) {
            return res.status(404).json({ status: 'error', message: error.message });
        }
        res.status(500).json({ status: 'error', message: error.message });
    }
};

module.exports = { createNewOrder, getAllOrders, getOrderById };