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

        res.render('exams/take', { exam, submissionId: submission._id });
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

        // Levenshtein-based similarity (0..1)
        function similarity(a, b) {
            const s1 = normalizeAnswer(a);
            const s2 = normalizeAnswer(b);
            if (!s1 && !s2) return 1;
            if (!s1 || !s2) return 0;
            const len1 = s1.length;
            const len2 = s2.length;
            const dp = Array.from({ length: len1 + 1 }, () => new Array(len2 + 1).fill(0));
            for (let i = 0; i <= len1; i++) dp[i][0] = i;
            for (let j = 0; j <= len2; j++) dp[0][j] = j;
            for (let i = 1; i <= len1; i++) {
                const c1 = s1.charCodeAt(i - 1);
                for (let j = 1; j <= len2; j++) {
                    const c2 = s2.charCodeAt(j - 1);
                    if (c1 === c2) {
                        dp[i][j] = dp[i - 1][j - 1];
                    } else {
                        dp[i][j] = Math.min(
                            dp[i - 1][j] + 1,     // deletion
                            dp[i][j - 1] + 1,     // insertion
                            dp[i - 1][j - 1] + 1  // substitution
                        );
                    }
                }
            }
            const dist = dp[len1][len2];
            const maxLen = Math.max(len1, len2) || 1;
            return 1 - dist / maxLen;
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
                // Open-ended or image question: accept text answer, auto-grade with fuzzy match (>= 75%)
                textAnswer = ansItem || '';
                if (Array.isArray(question.acceptedAnswers) && question.acceptedAnswers.length > 0) {
                    let best = 0;
                    for (const acc of question.acceptedAnswers) {
                        best = Math.max(best, similarity(textAnswer, acc));
                        if (best >= 0.75) break;
                    }
                    if (best >= 0.75) {
                        isCorrect = true;
                        score += question.points;
                    } else {
                        isCorrect = false;
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

        // Emit real-time events
        try {
            const io = req.app.get('io');
            if (io) {
                io.to(`submission:${submission._id}`).emit('submission:update', { status: 'submitted', score });
                io.to('admins').emit('reports:update', { type: 'submitted', submissionId: String(submission._id) });
            }
        } catch (e) { /* noop */ }

        // If AJAX request, return JSON to avoid page refresh
        const wantsJson = (req.get('x-requested-with') === 'XMLHttpRequest') || (req.get('accept') && req.get('accept').includes('application/json'));
        if (wantsJson) {
            return res.json({ ok: true, resultUrl: '/exams/results/' + submission._id });
        }
        req.flash('success', `Exam submitted! Your score: ${score}/${exam.questions.length}`);
        return res.redirect('/exams/results/' + submission._id);
    } catch (err) {
        console.error(err);
        const wantsJson = (req.get('x-requested-with') === 'XMLHttpRequest') || (req.get('accept') && req.get('accept').includes('application/json'));
        if (wantsJson) {
            return res.status(500).json({ ok: false, error: 'submit_failed' });
        }
        req.flash('error', 'Error submitting exam');
        return res.redirect('/exams');
    }
};

// Invalidate an in-progress submission (anti-cheat)
exports.invalidateExam = async (req, res) => {
    try {
        const submission = await Submission.findById(req.params.submissionId);
        if (!submission) return res.status(404).json({ ok: false });
        // Ensure only owner can invalidate own exam (from their session)
        if (String(submission.student) !== String(req.session.user._id)) {
            return res.status(403).json({ ok: false });
        }
        if (submission.status === 'in-progress') {
            submission.status = 'invalidated';
            await submission.save();
        }
        try {
            const io = req.app.get('io');
            if (io) {
                io.to(`submission:${submission._id}`).emit('submission:update', { status: 'invalidated' });
                io.to('admins').emit('reports:update', { type: 'invalidated', submissionId: String(submission._id) });
            }
        } catch (e) { /* noop */ }
        return res.json({ ok: true });
    } catch (err) {
        console.error('invalidateExam error', err);
        return res.status(500).json({ ok: false });
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