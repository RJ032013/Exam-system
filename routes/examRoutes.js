const express = require('express');
const router = express.Router();
const examController = require('../controllers/examController');

// Protect routes
router.use(async (req, res, next) => {
    if (!req.session.user) {
        req.flash('error', 'Please login first');
        return res.redirect('/login');
    }
    // Check session token
    const user = req.session.user;
    const UserModel = require('../models/User');
    const dbUser = await UserModel.findById(user._id);
    if (!dbUser || dbUser.sessionToken !== req.session.sessionToken) {
        // Invalidate any in-progress submissions for this user to prevent recovery
        try {
            const Submission = require('../models/Submission');
            await Submission.updateMany({ student: user._id, status: 'in-progress' }, { status: 'invalidated' });
        } catch (e) {
            console.error('Error invalidating submissions:', e);
        }
        req.session.destroy(() => {
            res.status(403).render('sessionEnded');
        });
        return;
    }
    next();
});

router.get('/', examController.getExams);
router.get('/take/:id', examController.getExam);
router.post('/submit/:id', examController.submitExam);
router.get('/results/:id', examController.getResults);
router.get('/my-results', examController.getMyResults);
router.post('/invalidate/:submissionId', examController.invalidateExam);

module.exports = router;