const orderService = require('../services/orderService');
const whatsappService = require('../services/whatsappService');

const createNewOrder = async (req, res) => {
    try {
        const storeId = req.store.store_id;

        const { customer_id, total_price, items, promo_code, payment_option } = req.body;

        if (!customer_id || !items || items.length === 0) {
            return res.status(400).json({
                status: 'error',
                message: 'Customer ID and at least one item are required'
            });
        }

        const finalPaymentOption = payment_option || 'NOW';

        const result = await orderService.createOrder(
            storeId,
            customer_id,
            total_price,
            items,
            promo_code,
            finalPaymentOption
        );

        whatsappService.sendReceiptWA(
            result.customer.phone_number,
            result.customer.name,
            result.order.id,
            result.order.total_price,
            finalPaymentOption,
            result.store_name,
            result.order.estimated_completion
        );

        if (result.customer) delete result.customer;

        res.status(201).json({
            status: 'success',
            message: 'Order created successfully',
            data: result
        });
    } catch (error) {
        res.status(400).json({ status: 'error', message: error.message });
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

const generateOrderPayment = async (req, res) => {
    try {
        const storeId = req.store.store_id;
        const orderId = req.params.id;

        const paymentData = await orderService.generatePaymentForExistingOrder(orderId, storeId);

        res.status(200).json({
            status: 'success',
            message: 'Link pembayaran QRIS berhasil dibuat',
            data: paymentData
        });
    } catch (error) {
        const statusCode = error.message.includes('tidak ditemukan') ? 404 : 400;
        res.status(statusCode).json({ status: 'error', message: error.message });
    }
};

const changeStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, message } = req.body;

        if (!status) {
            return res.status(400).json({ status: 'error', message: 'Status wajib diisi' });
        }

        const updatedOrder = await orderService.updateStatusAndNotify(id, status, message);

        res.status(200).json({
            status: 'success',
            message: `Status berhasil diubah menjadi ${status} dan notifikasi WA diproses`,
            data: updatedOrder
        });

    } catch (error) {
        console.error('Error changeStatus:', error.message);
        res.status(500).json({ status: 'error', message: error.message });
    }
};

const simulateETA = async (req, res) => {
    try {
        const store_id = req.store.store_id;

        const { service_id, quantity } = req.body;

        if (!service_id || !quantity) {
            return res.status(400).json({ status: 'error', message: 'Data tidak lengkap' });
        }

        const etaResult = await calculatePredictiveETA(store_id, service_id, quantity);

        res.status(200).json({
            status: 'success',
            data: etaResult
        });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
};

module.exports = { createNewOrder, getAllOrders, getOrderById, generateOrderPayment, changeStatus, simulateETA };