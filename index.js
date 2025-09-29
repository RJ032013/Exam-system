require('dotenv').config();
const express = require('express');
const flash = require('connect-flash');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const mongoose = require('mongoose');
const path = require('path');

const app = express();
const fs = require('fs');
const pathFs = require('path');

// Database connection
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log('MongoDB connected'))
.catch(err => console.log(err));

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));
// Ensure uploads directory exists
const uploadsDir = pathFs.join(__dirname, 'public', 'uploads');
try {
    if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
    }
} catch (e) {
    console.warn('Could not ensure uploads directory exists:', e.message);
}
app.set('view engine', 'ejs');
app.use(flash());

// Session middleware
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: process.env.MONGODB_URI
    }),
    cookie: {
        maxAge: 1000 * 60 * 60 * 24 // 1 day
    }
}));

// Make user and messages available in templates
app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    res.locals.messages = {
        error: req.flash('error'),
        success: req.flash('success')
    };
    next();
});

// Routes
app.use('/', require('./routes/authRoutes'));
app.use('/exams', require('./routes/examRoutes'));
app.use('/admin', require('./routes/adminRoutes'));

// Home route
app.get('/', (req, res) => {
    res.render('index');
});

// Session ended route
app.get('/session-ended', (req, res) => {
    res.render('sessionEnded');
});

// 404 handler
app.use((req, res) => {
    res.status(404).render('404');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
