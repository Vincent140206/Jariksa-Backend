const jwt = require('jsonwebtoken');
require('dotenv').config();

const protect = (req, res, next) => {
    const token = req.header('Authorization');

    if (!token) {
        return res.status(401).json({ status: 'error', message: 'Access denied. No token provided.' });
    }

    try {
        const decoded = jwt.verify(token.replace('Bearer ', ''), process.env.JWT_SECRET || 'jariksa-juara-satu-amin-amin');

        req.store = decoded;
        next();
    } catch (error) {
        res.status(401).json({ status: 'error', message: 'Invalid or expired token.' });
    }
};

module.exports = protect;