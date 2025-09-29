const User = require('../models/User');
const bcrypt = require('bcrypt');
const { sendOtpEmail } = require('../utils/mailer');
const crypto = require('crypto');

// Render register page
exports.getRegister = (req, res) => {
    res.render('auth/register');
};

// Handle registration (with optional confirmPassword)
exports.postRegister = async (req, res) => {
    const { username, email, password, confirmPassword } = req.body;

    if (typeof confirmPassword !== 'undefined' && password !== confirmPassword) {
        req.flash('error', 'Passwords do not match');
        return res.redirect('/register');
    }

    try {
        const existingUser = await User.findOne({ $or: [{ username }, { email }] });
        if (existingUser) {
            req.flash('error', 'Username or email already exists');
            return res.redirect('/register');
        }

        const hashedPassword = await bcrypt.hash(password, 12);
        const sessionToken = crypto.randomBytes(32).toString('hex');
        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        const user = new User({ username, email, password: hashedPassword, sessionToken, otp, isVerified: false });
        await user.save();

        // Send OTP email (best-effort)
        try {
            await sendOtpEmail(email, otp);
            req.flash('success', 'Registration successful! OTP sent to your email. Please verify.');
        } catch (mailErr) {
            console.error('Mail send error:', mailErr);
            req.flash('warning', 'Registration successful but failed to send OTP email. Contact admin.');
        }

        return res.redirect(`/verify-otp?email=${encodeURIComponent(email)}`);
    } catch (err) {
        console.error(err);
        req.flash('error', 'Server error');
        return res.redirect('/register');
    }
};

// Render login page
exports.getLogin = (req, res) => {
    res.render('auth/login');
};

// Handle login
exports.postLogin = async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await User.findOne({ username });
        if (!user) {
            req.flash('error', 'Invalid username or password');
            return res.redirect('/login');
        }

        if (!user.isVerified) {
            req.flash('error', 'Account not verified. Please check your email for OTP.');
            return res.redirect(`/verify-otp?email=${encodeURIComponent(user.email)}`);
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            req.flash('error', 'Invalid username or password');
            return res.redirect('/login');
        }

        const sessionToken = crypto.randomBytes(32).toString('hex');
        user.sessionToken = sessionToken;
        await user.save();

        req.session.user = user;
        req.session.sessionToken = sessionToken;
        req.flash('success', 'Login successful');
        return res.redirect('/');
    } catch (err) {
        console.error(err);
        req.flash('error', 'Login failed');
        return res.redirect('/login');
    }
};

// Render OTP verification page
exports.getVerifyOtp = (req, res) => {
    const email = req.query.email;
    res.render('auth/verifyOtp', { email });
};

// Handle OTP verification
exports.postVerifyOtp = async (req, res) => {
    const { email, otp } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user) {
            req.flash('error', 'User not found');
            return res.render('auth/verifyOtp', { email, messages: req.flash() });
        }
        if (user.otp !== otp) {
            req.flash('error', 'Invalid OTP');
            return res.render('auth/verifyOtp', { email, messages: req.flash() });
        }
        user.isVerified = true;
        user.otp = null;
        await user.save();
        req.flash('success', 'OTP verified! You can now login.');
        return res.redirect('/login');
    } catch (err) {
        console.error(err);
        req.flash('error', 'OTP verification failed');
        return res.render('auth/verifyOtp', { email, messages: req.flash() });
    }
};

// Handle logout
exports.logout = (req, res) => {
    req.session.destroy(err => {
        if (err) console.error(err);
        return res.redirect('/login');
    });
};