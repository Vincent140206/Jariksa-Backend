require('dotenv').config();
require('./config/db');
const express = require('express');
const cors = require('cors');

const healthRoutes = require('./routes/healthRoutes');
const aiRoutes = require('./routes/aiRoutes');
const authRoutes = require('./routes/authRoutes');
const businessRoutes = require('./routes/businessRoutes');
const customerRoutes = require('./routes/customerRoutes');
const orderRoutes = require('./routes/orderRoutes');
const paymentController = require('./controllers/paymentController');
const promoRoutes = require('./routes/promoRoutes');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use('/api/health', healthRoutes);

app.listen(port, () => {
    console.log(`[LOCAL] Server JaRiksa berjalan di http://localhost:${port}`);
});

app.use('/api/ai', aiRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/business', businessRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/orders', orderRoutes);
app.post('/api/payments/notification', paymentController.handleMidtransNotification);
app.use('/api/promos', promoRoutes);