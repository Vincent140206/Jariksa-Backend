const pool = require('../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { sendResetEmail } = require('./emailService');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'jariksa-juara-satu-amin-amin';

const registerStore = async (storeName, email, password) => {
    const userExist = await pool.query('SELECT * FROM stores WHERE email = $1', [email]);
    if (userExist.rows.length > 0) throw new Error('Email is already in use');

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = await pool.query(
        'INSERT INTO stores (store_name, email, password) VALUES ($1, $2, $3) RETURNING id, store_name, email',
        [storeName, email, hashedPassword]
    );

    return newUser.rows[0];
};

const loginStore = async (email, password) => {

    const user = await pool.query('SELECT * FROM stores WHERE email = $1', [email]);
    if (user.rows.length === 0) throw new Error('Invalid email or password');

    const storeData = user.rows[0];

    const validPassword = await bcrypt.compare(password, storeData.password);
    if (!validPassword) throw new Error('Invalid email or password');

    const token = jwt.sign(
        { store_id: storeData.id, store_name: storeData.store_name },
        JWT_SECRET,
        { expiresIn: '7d' }
    );

    return {
        token,
        store: { id: storeData.id, store_name: storeData.store_name, email: storeData.email }
    };
};

const requestPasswordReset = async (email) => {
    const user = await pool.query('SELECT * FROM stores WHERE email = $1', [email]);
    if (user.rows.length === 0) throw new Error('Email not found');

    const storeData = user.rows[0];

    const secret = process.env.JWT_SECRET + storeData.password;

    const payload = { email: storeData.email, store_id: storeData.id };
    const token = jwt.sign(payload, secret, { expiresIn: '15m' });

    const resetLink = `jariksa://reset-password?id=${storeData.id}&token=${token}`;
    console.log("\n=== PASSWORD RESET LINK ===");
    console.log(resetLink);
    console.log("===========================\n");

    await sendResetEmail(storeData.email, resetLink);

    return { message: 'Reset link sent to your email' };
};

const resetPassword = async (storeId, token, newPassword) => {
    const user = await pool.query('SELECT * FROM stores WHERE id = $1', [storeId]);
    if (user.rows.length === 0) throw new Error('Invalid request');

    const storeData = user.rows[0];
    const secret = process.env.JWT_SECRET + storeData.password;

    try {
        jwt.verify(token, secret);
    } catch (error) {
        throw new Error('Token is invalid or has expired');
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await pool.query('UPDATE stores SET password = $1 WHERE id = $2', [hashedPassword, storeId]);

    return { message: 'Password has been successfully reset' };
};

module.exports = { registerStore, loginStore, requestPasswordReset, resetPassword };