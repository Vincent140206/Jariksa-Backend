const healthService = require('../services/healthService');

const checkHealth = (req, res) => {
    try {
        const data = healthService.getSystemStatus();
        res.status(200).json(data);
    } catch (error) {
        res.status(500).json({ error: 'Terjadi kesalahan pada server' });
    }
};

module.exports = { checkHealth };