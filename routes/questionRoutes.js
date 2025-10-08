const express = require('express');
const authController = require('../controllers/authController');
const questionController = require('../controllers/questionController');

const router = express.Router();

router.use(authController.protect);

router.post('/', questionController.create);
router.patch('/:id', questionController.update);
router.delete('/:id', questionController.delete);
module.exports = router;
