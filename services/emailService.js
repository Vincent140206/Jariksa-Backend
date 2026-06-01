const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    },
    tls: {
        rejectUnauthorized: false
    }
});

const sendResetEmail = async (toEmail, resetLink) => {
    const mailOptions = {
        from: `"JaRiksa Support" <${process.env.EMAIL_USER}>`,
        to: toEmail,
        subject: 'Password Reset Request - JaRiksa',
        html: `
            <div style="font-family: Arial, sans-serif; text-align: center; padding: 20px;">
                <h2>Reset Your Password</h2>
                <p>You requested to reset your password. Click the button below to set a new password. This link is valid for 15 minutes.</p>
                <br>
                <a href="${resetLink}" style="padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">Reset Password</a>
                <br><br>
                <p style="color: #888;">If you did not request this, please ignore this email.</p>
            </div>
        `
    };

    return transporter.sendMail(mailOptions);
};

module.exports = { sendResetEmail };