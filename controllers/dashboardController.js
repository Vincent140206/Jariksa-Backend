const dashboardService = require('../services/dashboardService');

const getDashboardSummary = async (req, res) => {
    try {
        const storeId = req.store.store_id;

        const dashboardData = await dashboardService.getDashboardData(storeId);

        res.status(200).json({
            status: 'success',
            data: dashboardData
        });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
};

module.exports = { getDashboardSummary };