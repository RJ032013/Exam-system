const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    role: {
        type: String,
        enum: ['student', 'faculty', 'admin'],
        default: 'student'
    },
    department: {
        type: String,
        default: ''
    },
    assignedFaculty: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    sessionToken: {
        type: String,
        default: null
    }
    ,
    otp: {
        type: String,
        default: null
    },
    isVerified: {
        type: Boolean,
        default: true
    }
});

module.exports = mongoose.model('User', UserSchema);