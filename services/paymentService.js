const midtransClient = require('midtrans-client');
require('dotenv').config();

const snap = new midtransClient.Snap({
    isProduction: process.env.MIDTRANS_IS_PRODUCTION === 'true',
    serverKey: process.env.MIDTRANS_SERVER_KEY,
    clientKey: process.env.MIDTRANS_CLIENT_KEY
});

const formatMidtransDate = (date) => {
    const pad = (n) => String(n).padStart(2, '0');
    const wib = new Date(date.getTime() + 7 * 60 * 60 * 1000);
    const yyyy = wib.getUTCFullYear();
    const mm = pad(wib.getUTCMonth() + 1);
    const dd = pad(wib.getUTCDate());
    const hh = pad(wib.getUTCHours());
    const mi = pad(wib.getUTCMinutes());
    const ss = pad(wib.getUTCSeconds());
    return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss} +0700`;
};

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
            "expiry": {
                "start_time": formatMidtransDate(new Date()),
                "unit": "minute",
                "duration": 15
            }
        };
        const transaction = await snap.createTransaction(parameter);
        return transaction;
    } catch (error) {
        throw new Error('Failed to generate Midtrans token: ' + error.message);
    }
};

module.exports = { createPaymentToken };