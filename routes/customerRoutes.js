const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');
const protect = require('../middlewares/authMiddleware');

router.post('/check', protect, customerController.checkCustomer);
router.post('/', protect, customerController.addCustomer);
router.get('/', protect, customerController.getCustomers);

module.exports = router;