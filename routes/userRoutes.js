const express = require('express');
const authController = require('../controllers/authController');
const userController = require('../controllers/userController');
const interviewController = require('../controllers/interviewController');

const router = express.Router();

router.post('/signup', authController.signup);
router.post('/login', authController.login);
router.get('/loginStatus', authController.isLoggedIn);

router.post('/forgotPassword', authController.forgotPassword);
router.patch('/resetPassword', authController.resetPassword);

router.use(authController.protect);

router.route('/myInterviews').get(interviewController.getMyInterviews);
router.patch('/updateMyPassword', authController.updatePassword);
router.get('/logout', authController.logout);

//These routes are accessible only to admins
router.use(authController.restrictTo('admin'));

router
  .route('/')
  .get(userController.getAllUsers)
  .post(userController.createUser);
router
  .route('/:regNo')
  .get(userController.getUser)
  .patch(userController.updateUser)
  .delete(userController.deleteUser);

router
  .route('/batch/:year')
  .post(userController.uploadBatch, userController.batchEntry);

module.exports = router;
