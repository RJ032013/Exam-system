const mongoose = require('mongoose');

const QuestionSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['mcq', 'open', 'image'],
        default: 'mcq'
    },
    question: {
        type: String,
        required: true
    },
    imagePath: {
        type: String,
        default: null
    },
    acceptedAnswers: [{
        type: String
    }],
    options: [{
        type: String
    }],
    correctAnswer: {
        type: Number,
        required: false,
        default: null
    },
    points: {
        type: Number,
        default: 1
    }
});

module.exports = mongoose.model('Question', QuestionSchema);