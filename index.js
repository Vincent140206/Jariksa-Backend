require('dotenv').config();
const express = require('express');
const cors = require('cors');

const healthRoutes = require('./routes/healthRoutes');
const aiRoutes = require('./routes/aiRoutes');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use('/api/health', healthRoutes);

app.listen(port, () => {
    console.log(`[LOCAL] Server JaRiksa berjalan di http://localhost:${port}`);
});

app.use('/api/ai', aiRoutes);