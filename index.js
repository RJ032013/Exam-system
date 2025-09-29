require('dotenv').config();
const express = require('express');
const flash = require('connect-flash');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const mongoose = require('mongoose');
const path = require('path');

const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require('socket.io');
const io = new Server(server);
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
    res.locals.SOCKET_IO = true;
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

// Socket.io basic rooms for submissions (real-time)
io.on('connection', (socket) => {
    socket.on('join-submission', (submissionId) => {
        if (submissionId) socket.join(`submission:${submissionId}`);
    });
    socket.on('join-admin', () => socket.join('admins'));
    socket.on('join-user', (userId) => {
        if (userId) socket.join(`user:${userId}`);
    });
});

// Helper emitter
app.set('io', io);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
