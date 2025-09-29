const Exam = require('../models/Exam');
const Submission = require('../models/Submission');

exports.getExams = async (req, res) => {
    try {
        const exams = await Exam.find({ isActive: true }).populate('createdBy', 'username');
        res.render('exams/list', { exams });
    } catch (err) {
        console.error(err);
        req.flash('error', 'Error fetching exams');
        res.redirect('/');
    }
};

exports.getExam = async (req, res) => {
    try {
        const exam = await Exam.findById(req.params.id).populate('questions');
        if (!exam) {
            req.flash('error', 'Exam not found');
            return res.redirect('/exams');
        }

        // Check if user already submitted
        let submission = await Submission.findOne({
            student: req.session.user._id,
            exam: exam._id
        });

        if (submission && submission.status === 'submitted') {
            req.flash('error', 'You have already taken this exam');
            return res.redirect('/exams');
        }

        if (submission && submission.status === 'invalidated') {
            // session ended / invalidated - cannot recover
            return res.status(403).render('sessionEnded');
        }

        // If no submission exists, create an in-progress submission
        if (!submission) {
            submission = new Submission({
                student: req.session.user._id,
                exam: exam._id,
                answers: [],
                totalQuestions: exam.questions.length,
                status: 'in-progress'
            });
            await submission.save();
        }

        res.render('exams/take', { exam });
    } catch (err) {
        console.error(err);
        req.flash('error', 'Error loading exam');
        res.redirect('/exams');
    }
};

exports.submitExam = async (req, res) => {
    try {
        const exam = await Exam.findById(req.params.id).populate('questions');
        const answers = req.body.answers;
        
        let score = 0;
        const processedAnswers = [];

        function normalizeAnswer(str) {
            if (!str) return '';
            return String(str)
                .toLowerCase()
                .normalize('NFD')
                .replace(/\p{Diacritic}+/gu, '')
                .replace(/[^a-z0-9]+/g, ' ')
                .trim();
        }

        for (let i = 0; i < exam.questions.length; i++) {
            const question = exam.questions[i];
            let selectedOption = null;
            let textAnswer = '';
            let isCorrect = false;

            // answers may be an object; normalize access
            const ansItem = Array.isArray(answers) ? answers[i] : (answers && answers[i]) ? answers[i] : undefined;

            if (question.options && question.options.length > 0) {
                // MCQ
                if (ansItem !== undefined && ansItem !== null && ansItem !== '') {
                    selectedOption = parseInt(ansItem);
                    isCorrect = (selectedOption === question.correctAnswer);
                    if (isCorrect) score += question.points;
                }
            } else {
                // Open-ended or image question: accept text answer, auto-grade if acceptedAnswers present
                textAnswer = ansItem || '';
                const normalized = normalizeAnswer(textAnswer);
                if (Array.isArray(question.acceptedAnswers) && question.acceptedAnswers.length > 0) {
                    const accepted = question.acceptedAnswers.map(a => normalizeAnswer(a));
                    if (accepted.includes(normalized)) {
                        isCorrect = true;
                        score += question.points;
                    }
                } else {
                    isCorrect = false;
                }
            }

            processedAnswers.push({
                question: question._id,
                selectedOption,
                isCorrect,
                textAnswer
            });
        }

        let submission = await Submission.findOne({ student: req.session.user._id, exam: exam._id });
        if (!submission) {
            req.flash('error', 'Submission not found or session expired');
            return res.redirect('/exams');
        }

        if (submission.status === 'invalidated') {
            return res.status(403).render('sessionEnded');
        }

        if (submission.status === 'submitted') {
            req.flash('error', 'You have already submitted this exam');
            return res.redirect('/exams');
        }

        submission.answers = processedAnswers;
        submission.score = score;
        submission.totalQuestions = exam.questions.length;
        submission.status = 'submitted';
        submission.submittedAt = Date.now();

        await submission.save();

        req.flash('success', `Exam submitted! Your score: ${score}/${exam.questions.length}`);
        res.redirect('/exams/results/' + submission._id);
    } catch (err) {
        console.error(err);
        req.flash('error', 'Error submitting exam');
        res.redirect('/exams');
    }
};

exports.getResults = async (req, res) => {
    try {
        const submission = await Submission.findById(req.params.id)
            .populate('exam')
            .populate('answers.question');

        if (!submission || submission.student.toString() !== req.session.user._id.toString()) {
            req.flash('error', 'Results not found');
            return res.redirect('/exams');
        }

        res.render('exams/results', { submission });
    } catch (err) {
        console.error(err);
        req.flash('error', 'Error loading results');
        res.redirect('/exams');
    }
};