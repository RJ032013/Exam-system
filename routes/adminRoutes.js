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
const excelUpload = multer({ storage });
const User = require('../models/User');

// Access guards
function requireAdminOrFaculty(req, res, next) {
    if (!req.session.user || (req.session.user.role !== 'admin' && req.session.user.role !== 'faculty')) {
        req.flash('error', 'Access denied');
        return res.redirect('/');
    }
    next();
}

function requireAdmin(req, res, next) {
    if (!req.session.user || req.session.user.role !== 'admin') {
        req.flash('error', 'Admin access required');
        return res.redirect('/admin/dashboard');
    }
    next();
}

// Protect admin area base
router.use(requireAdminOrFaculty);

router.get('/dashboard', adminController.getDashboard);
router.get('/create-exam', adminController.getCreateExam);
router.post('/create-exam', upload.array('questionImages'), adminController.postCreateExam);
router.get('/download-mcq-template', adminController.downloadMcqTemplate);
router.post('/import-mcq-excel', excelUpload.single('mcqExcel'), adminController.importMcqExcel);
router.get('/manage-exams', adminController.getManageExams);
router.get('/toggle-exam/:id', requireAdmin, adminController.toggleExamStatus);
router.get('/exam-reports', adminController.getExamReports);
router.get('/exam-reports/:id', adminController.getExamReportDetail);
router.post('/exam-reports/reset/:id', requireAdmin, adminController.resetSubmission);
// Faculty and student management
router.get('/manage-faculty', requireAdmin, adminController.getManageFaculty);
router.post('/manage-faculty', requireAdmin, adminController.postCreateFaculty);
router.get('/students-by-faculty', requireAdmin, adminController.getStudentsByFaculty);
router.post('/assign-student-faculty', requireAdmin, adminController.assignStudentFaculty);
router.get('/invalidated', adminController.getInvalidatedSubmissions);
// alias for convenience
router.get('/exam-invalidated', adminController.getInvalidatedSubmissions);
router.get('/edit-exam/:id', requireAdmin, adminController.getEditExam);
router.post('/edit-exam/:id', requireAdmin, upload.array('questionImages'), adminController.postEditExam);
// Category routes
router.get('/manage-categories', requireAdmin, adminController.getManageCategories);
router.post('/manage-categories', requireAdmin, adminController.postCreateCategory);
router.get('/edit-category/:id', requireAdmin, adminController.getEditCategory);
router.post('/edit-category/:id', requireAdmin, adminController.postEditCategory);
router.get('/delete-category/:id', requireAdmin, adminController.deleteCategory);

module.exports = router;