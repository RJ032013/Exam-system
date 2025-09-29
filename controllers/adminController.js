const Exam = require('../models/Exam');
const Question = require('../models/Question');
const Submission = require('../models/Submission');
const Category = require('../models/Category');

exports.getDashboard = async (req, res) => {
    try {
        const exams = await Exam.countDocuments();
        const submissions = await Submission.countDocuments();
        const categories = await Category.countDocuments();
        const recentExams = await Exam.find().sort({ createdAt: -1 }).limit(5);
        
        res.render('admin/dashboard', { exams, submissions, categories, recentExams });
    } catch (err) {
        console.error(err);
        req.flash('error', 'Error loading dashboard');
        res.redirect('/');
    }
};

// Category management
exports.getManageCategories = async (req, res) => {
    try {
        const categories = await Category.find().sort({ createdAt: -1 });
        res.render('admin/manageCategories', { categories });
    } catch (err) {
        console.error(err);
        req.flash('error', 'Error loading categories');
        res.redirect('/admin/dashboard');
    }
};

exports.postCreateCategory = async (req, res) => {
    try {
        const { name, description } = req.body;
        const category = new Category({ name, description });
        await category.save();
        req.flash('success', 'Category created');
        res.redirect('/admin/manage-categories');
    } catch (err) {
        console.error(err);
        req.flash('error', 'Error creating category');
        res.redirect('/admin/manage-categories');
    }
};

exports.getEditCategory = async (req, res) => {
    try {
        const category = await Category.findById(req.params.id);
        if (!category) {
            req.flash('error', 'Category not found');
            return res.redirect('/admin/manage-categories');
        }
        res.render('admin/editCategory', { category });
    } catch (err) {
        console.error(err);
        req.flash('error', 'Error loading category');
        res.redirect('/admin/manage-categories');
    }
};

exports.postEditCategory = async (req, res) => {
    try {
        const { name, description } = req.body;
        await Category.findByIdAndUpdate(req.params.id, { name, description });
        req.flash('success', 'Category updated');
        res.redirect('/admin/manage-categories');
    } catch (err) {
        console.error(err);
        req.flash('error', 'Error updating category');
        res.redirect('/admin/manage-categories');
    }
};

exports.deleteCategory = async (req, res) => {
    try {
        await Category.findByIdAndDelete(req.params.id);
        req.flash('success', 'Category deleted');
        res.redirect('/admin/manage-categories');
    } catch (err) {
        console.error(err);
        req.flash('error', 'Error deleting category');
        res.redirect('/admin/manage-categories');
    }
};

exports.getCreateExam = (req, res) => {
    // send categories to view
    Category.find().then(categories => {
        res.render('admin/createExam', { categories });
    }).catch(err => {
        console.error(err);
        res.render('admin/createExam', { categories: [] });
    });
};

exports.postCreateExam = async (req, res) => {
    try {
        const { subject, title, description, duration, questions } = req.body;
        
        const createdQuestions = [];
        // Normalize questions: when form sends a single question or object, convert to array
        let qList = questions || [];
        if (!Array.isArray(qList) && typeof qList === 'object') {
            qList = Object.keys(qList).map(k => qList[k]);
        }
        const uploadedFiles = Array.isArray(req.files) ? req.files : [];
        // Hidden inputs carry mapping order; we will attach files sequentially to image questions
        let fileCursor = 0;

        for (let idx = 0; idx < qList.length; idx++) {
            const q = qList[idx];
            // q may come as strings from form; ensure options exist
            const qText = q.text;
            const qPoints = q.points ? parseInt(q.points) : 1;
            const qType = q.type || 'mcq';

            let questionData = { question: qText, points: qPoints, type: qType };

            // Attach image if provided and type is image (assign sequentially)
            if (qType === 'image' && uploadedFiles[fileCursor]) {
                const file = uploadedFiles[fileCursor++];
                questionData.imagePath = `/uploads/${file.filename}`;
            }

            if (q.options) {
                // options may be an object or array depending on form; normalize to array
                let opts = q.options;
                if (typeof opts === 'object' && !Array.isArray(opts)) {
                    // form serializes arrays as object with numeric keys
                    opts = Object.keys(opts).map(k => opts[k]);
                }
                if (Array.isArray(opts)) questionData.options = opts.filter(v => v !== undefined && v !== null && v !== '');
                if (q.correctAnswer !== undefined && q.correctAnswer !== '') {
                    questionData.correctAnswer = parseInt(q.correctAnswer);
                }
            }

            // Accepted answers for auto-grading open/image
            if (q.acceptedAnswers) {
                let acc = q.acceptedAnswers;
                if (typeof acc === 'string') {
                    acc = acc.split(',').map(s => s.trim()).filter(Boolean);
                }
                if (Array.isArray(acc) && acc.length > 0) {
                    questionData.acceptedAnswers = acc;
                }
            }
            const question = new Question(questionData);
            await question.save();
            createdQuestions.push(question._id);
        }

        const exam = new Exam({
            subject: subject || '',
            title,
            description,
            duration: parseInt(duration),
            questions: createdQuestions,
            createdBy: req.session.user._id,
            category: req.body.category || null
        });

        await exam.save();
        req.flash('success', 'Exam created successfully');
        res.redirect('/admin/dashboard');
    } catch (err) {
        console.error(err);
        req.flash('error', 'Error creating exam');
        res.redirect('/admin/create-exam');
    }
};

exports.getManageExams = async (req, res) => {
    try {
        const exams = await Exam.find().populate('createdBy', 'username').populate('category', 'name');
        res.render('admin/manageExams', { exams });
    } catch (err) {
        console.error(err);
        req.flash('error', 'Error loading exams');
        res.redirect('/admin/dashboard');
    }
};

exports.toggleExamStatus = async (req, res) => {
    try {
        const exam = await Exam.findById(req.params.id);
        exam.isActive = !exam.isActive;
        await exam.save();
        
        req.flash('success', `Exam ${exam.isActive ? 'activated' : 'deactivated'}`);
        res.redirect('/admin/manage-exams');
    } catch (err) {
        console.error(err);
        req.flash('error', 'Error updating exam');
        res.redirect('/admin/manage-exams');
    }
};

// Reports: list all submitted exams with filters
exports.getExamReports = async (req, res) => {
    try {
        const exams = await Exam.find().sort({ createdAt: -1 });
        const submissions = await Submission.find({ status: 'submitted' })
            .populate('exam', 'title subject')
            .populate('student', 'username email')
            .sort({ submittedAt: -1 });
        res.render('admin/reports', { exams, submissions });
    } catch (err) {
        console.error(err);
        req.flash('error', 'Error loading reports');
        res.redirect('/admin/dashboard');
    }
};

// Report details for a single submission
exports.getExamReportDetail = async (req, res) => {
    try {
        const submission = await Submission.findById(req.params.id)
            .populate('exam')
            .populate('student', 'username email')
            .populate('answers.question');
        if (!submission) {
            req.flash('error', 'Submission not found');
            return res.redirect('/admin/exam-reports');
        }
        res.render('admin/reportDetail', { submission });
    } catch (err) {
        console.error(err);
        req.flash('error', 'Error loading report');
        res.redirect('/admin/exam-reports');
    }
};