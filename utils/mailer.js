require('dotenv').config();
const nodemailer = require('nodemailer');

const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_SERVICE = process.env.SMTP_SERVICE || 'gmail';

let transporter;
if (SMTP_USER && SMTP_PASS) {
    transporter = nodemailer.createTransport({
        service: SMTP_SERVICE,
        auth: { user: SMTP_USER, pass: SMTP_PASS }
    });
} else {
    console.warn('SMTP credentials not set. Configure SMTP_USER and SMTP_PASS in environment.');
}

function sendOtpEmail(to, otp) {
    if (!transporter) return Promise.reject(new Error('No mail transporter configured'));
    const mailOptions = {
        from: SMTP_USER,
        to: to,
        subject: 'Your OTP Verification Code',
        text: `Your OTP code is: ${otp}`
    };
    return transporter.sendMail(mailOptions);
}

module.exports = { sendOtpEmail };