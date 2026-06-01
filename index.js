require('dotenv').config();
require('./config/db');
const express = require('express');
const cors = require('cors');

const healthRoutes = require('./routes/healthRoutes');
const aiRoutes = require('./routes/aiRoutes');
const authRoutes = require('./routes/authRoutes');
const businessRoutes = require('./routes/businessRoutes');

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