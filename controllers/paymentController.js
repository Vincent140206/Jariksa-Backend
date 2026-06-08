const pool = require('../config/db');

const handleMidtransNotification = async (req, res) => {
    try {
        const notification = req.body;

        const orderIdStr = notification.order_id;
        const transactionStatus = notification.transaction_status;
        const fraudStatus = notification.fraud_status;

        const actualOrderId = orderIdStr.split('-')[1];

        let newStatus = 'Pending Payment';

        if (transactionStatus === 'capture' || transactionStatus === 'settlement') {
            if (fraudStatus === 'challenge') {
                newStatus = 'Payment Challenged';
            } else {
                newStatus = 'Diproses';
            }
        } else if (transactionStatus === 'cancel' || transactionStatus === 'deny' || transactionStatus === 'expire') {
            newStatus = 'Dibatalkan';
        } else if (transactionStatus === 'pending') {
            newStatus = 'Menunggu Pembayaran';
        }

        await pool.query('UPDATE orders SET status = $1 WHERE id = $2', [newStatus, actualOrderId]);

        res.status(200).json({ status: 'success', message: 'Notification processed' });
    } catch (error) {
        console.error('Midtrans Notification Error:', error);
        res.status(500).json({ status: 'error', message: error.message });
    }
};

module.exports = { handleMidtransNotification };