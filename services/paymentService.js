const midtransClient = require('midtrans-client');
require('dotenv').config();

const snap = new midtransClient.Snap({
    isProduction: process.env.MIDTRANS_IS_PRODUCTION === 'true',
    serverKey: process.env.MIDTRANS_SERVER_KEY,
    clientKey: process.env.MIDTRANS_CLIENT_KEY
});

const createPaymentToken = async (orderId, grossAmount, customerName, customerPhone) => {
    try {
        const parameter = {
            "transaction_details": {
                "order_id": `JARIKSA-${orderId}-${Date.now()}`,
                "gross_amount": grossAmount
            },
            "customer_details": {
                "first_name": customerName,
                "phone": customerPhone
            },
            "custom_expiry": {
                "expiry_duration": 15,
                "unit": "minute"
            }
        };

        const transaction = await snap.createTransaction(parameter);
        return transaction;
    } catch (error) {
        throw new Error('Failed to generate Midtrans token: ' + error.message);
    }
};

module.exports = { createPaymentToken };