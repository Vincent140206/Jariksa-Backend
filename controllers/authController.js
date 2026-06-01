const authService = require('../services/authService');

const register = async (req, res) => {
    try {
        const { store_name, email, password } = req.body;
        const result = await authService.registerStore(store_name, email, password);

        res.status(201).json({
            status: 'success',
            message: 'Store registered successfully',
            data: result
        });
    } catch (error) {
        res.status(400).json({ status: 'error', message: error.message });
    }
};

const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const result = await authService.loginStore(email, password);

        res.status(200).json({
            status: 'success',
            message: 'Login successful',
            data: result
        });
    } catch (error) {
        res.status(401).json({ status: 'error', message: error.message });
    }
};

const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        const result = await authService.requestPasswordReset(email);

        res.status(200).json({ status: 'success', data: result });
    } catch (error) {
        res.status(404).json({ status: 'error', message: error.message });
    }
};

const resetPassword = async (req, res) => {
    try {
        const { id, token } = req.query;
        const { new_password } = req.body;

        const result = await authService.resetPassword(id, token, new_password);
        res.status(200).json({ status: 'success', data: result });
    } catch (error) {
        res.status(400).json({ status: 'error', message: error.message });
    }
};

module.exports = { register, login, forgotPassword, resetPassword };