const express = require('express');
const interviewController = require('../controllers/interviewController');
const authController = require('../controllers/authController');

const router = express.Router();

router.use(authController.protect, authController.restrictTo("admin", "verifier"));

router.route('/verificationQueue').get(interviewController.getVerificationQueue);

router.route('/:id/accepted').patch(interviewController.accepted);
router.route('/:id/rejected').patch(interviewController.rejected);

module.exports = router;
