const express = require('express');
const authController = require('../controllers/authController');
const roundController = require('../controllers/roundController');

const router = express.Router();

router.use(authController.protect);

router.post('/', roundController.create);
router.patch('/:id', roundController.update);
router.delete('/:id', roundController.delete);
module.exports = router;
