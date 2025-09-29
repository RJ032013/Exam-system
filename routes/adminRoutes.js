const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const multer = require('multer');
const path = require('path');

// Multer storage for question images
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join('public', 'uploads'));
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = path.extname(file.originalname);
        cb(null, 'q-' + uniqueSuffix + ext);
    }
});

const upload = multer({ storage });

// Protect admin routes
router.use((req, res, next) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        req.flash('error', 'Access denied');
        return res.redirect('/');
    }
    next();
});

router.get('/dashboard', adminController.getDashboard);
router.get('/create-exam', adminController.getCreateExam);
router.post('/create-exam', upload.array('questionImages'), adminController.postCreateExam);
router.get('/manage-exams', adminController.getManageExams);
router.get('/toggle-exam/:id', adminController.toggleExamStatus);
router.get('/exam-reports', adminController.getExamReports);
router.get('/exam-reports/:id', adminController.getExamReportDetail);
router.post('/exam-reports/reset/:id', adminController.resetSubmission);
router.get('/invalidated', adminController.getInvalidatedSubmissions);
// alias for convenience
router.get('/exam-invalidated', adminController.getInvalidatedSubmissions);
router.get('/edit-exam/:id', adminController.getEditExam);
router.post('/edit-exam/:id', upload.array('questionImages'), adminController.postEditExam);
// Category routes
router.get('/manage-categories', adminController.getManageCategories);
router.post('/manage-categories', adminController.postCreateCategory);
router.get('/edit-category/:id', adminController.getEditCategory);
router.post('/edit-category/:id', adminController.postEditCategory);
router.get('/delete-category/:id', adminController.deleteCategory);

module.exports = router;