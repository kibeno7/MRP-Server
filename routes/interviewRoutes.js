const express = require('express');
const authController = require('../controllers/authController');
const interviewController = require('../controllers/interviewController');
const posterController = require('../controllers/posterController');

const router = express.Router();

router.route('/').get(interviewController.getAllInterviews);
router.route('/:id').get(interviewController.getInterview);

router.use(authController.protect);

router.route('/').post(interviewController.createInterview);
router
  .route('/:id')
  .patch(interviewController.updateInterview)
  .delete(interviewController.deleteInterview);

router
  .route('/:id/poster')
  .post(posterController.uploadUserPhoto, posterController.generatePoster);

router.route('/:id/poster/download').get(posterController.downloadPoster);

router
  .route('/verificationQueue')
  .get(interviewController.getVerificationQueue);

router.route('/:id/accepted').patch(interviewController.accepted);
router.route('/:id/rejected').patch(interviewController.rejected);

module.exports = router;
