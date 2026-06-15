require('dotenv').config();
require('./config/db');
require('./config/cron')
const express = require('express');
const cors = require('cors');

const { initializeWhatsApp, sendTestMessage } = require('./services/whatsappService');
const healthRoutes = require('./routes/healthRoutes');
const aiRoutes = require('./routes/aiRoutes');
const authRoutes = require('./routes/authRoutes');
const businessRoutes = require('./routes/businessRoutes');
const customerRoutes = require('./routes/customerRoutes');
const orderRoutes = require('./routes/orderRoutes');
const paymentController = require('./controllers/paymentController');
const promoRoutes = require('./routes/promoRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes')
const webhookRoutes = require('./routes/webhookRoutes');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json())
app.use('/api/health', healthRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/business', businessRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/orders', orderRoutes);
app.post('/api/payments/notification', paymentController.handleMidtransNotification);
app.use('/api/promos', promoRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/webhook', webhookRoutes);

app.listen(port, () => {
    console.log(`[LOCAL] Server JaRiksa berjalan di http://localhost:${port}`);
});

initializeWhatsApp();

app.post('/api/test-wa', async (req, res) => {
    try {
        const { phone, message } = req.body;
        if (!phone || !message) {
            return res.status(400).json({ error: 'Butuh phone dan message' });
        }

        const result = await sendTestMessage(phone, message);
        res.status(200).json({ status: 'success', message: result });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});