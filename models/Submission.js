const mongoose = require('mongoose');

const SubmissionSchema = new mongoose.Schema({
    student: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    exam: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Exam',
        required: true
    },
    answers: [{
        question: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Question'
        },
        selectedOption: Number,
        isCorrect: Boolean,
        textAnswer: { type: String, default: '' }
    }],
    score: {
        type: Number,
        default: 0
    },
    totalQuestions: {
        type: Number,
        required: true
    },
    questionOrder: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Question'
    }],
    // For MCQs: per-question option index permutation aligned with questionOrder positions
    optionOrder: [[Number]],
    status: {
        type: String,
        enum: ['in-progress', 'submitted', 'invalidated'],
        default: 'in-progress'
    },
    submittedAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Submission', SubmissionSchema);