const formatMidtransDate = (date) => {
    const pad = (n) => String(n).padStart(2, '0');
    const yyyy = date.getFullYear();
    const mm = pad(date.getMonth() + 1);
    const dd = pad(date.getDate());
    const hh = pad(date.getHours());
    const mi = pad(date.getMinutes());
    const ss = pad(date.getSeconds());
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