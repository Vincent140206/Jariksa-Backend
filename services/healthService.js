const getSystemStatus = () => {
    return {
        status: 'success',
        message: 'Sistem JaRiksa berjalan normal (Layered Architecture)',
        timestamp: new Date().toISOString()
    };
};

module.exports = { getSystemStatus };