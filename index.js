require('dotenv').config();
const express = require('express');
const cors = require('cors');

// Import routes
const healthRoutes = require('./routes/healthRoutes');
const aiRoutes = require('./routes/aiRoutes');

const app = express();
const port = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());

// Daftarkan routes
app.use('/api/health', healthRoutes);

// Jalankan server
app.listen(port, () => {
    console.log(`[LOCAL] Server JaRiksa berjalan di http://localhost:${port}`);
});

app.use('/api/ai', aiRoutes);