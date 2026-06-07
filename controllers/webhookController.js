const crypto = require('crypto');
const orderService = require('../services/orderService');

const midtransNotification = async (req, res) => {
    try {
        const notification = req.body;

        if (notification.order_id && notification.order_id.includes('payment_notif_test')) {
            console.log('Tes dari Dashboard Midtrans diterima!');
            return res.status(200).json({ status: 'success', message: 'Test notification received successfully' });
        }

        const serverKey = process.env.MIDTRANS_SERVER_KEY;

        const hash = crypto.createHash('sha512');
        const signatureInput = notification.order_id + notification.status_code + notification.gross_amount + serverKey;
        hash.update(signatureInput);
        const calculatedSignature = hash.digest('hex');

        if (notification.signature_key !== calculatedSignature) {
            console.log('Webhook diblokir: Signature tidak cocok!');
            return res.status(403).json({ status: 'error', message: 'Invalid signature' });
        }

        await orderService.updateOrderStatusFromMidtrans(notification.order_id, notification.transaction_status);

        res.status(200).json({ status: 'success', message: 'OK' });

    } catch (error) {
        console.error('Webhook error:', error.message);
        res.status(500).json({ status: 'error', message: error.message });
    }
};

module.exports = { midtransNotification };