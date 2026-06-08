const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');
const protect = require('../middlewares/authMiddleware');

router.post('/', protect, customerController.addCustomer);
router.get('/check', protect, customerController.checkCustomer);
router.get('/simple', protect, customerController.getCustomers);

router.get('/', protect, customerController.getCustomersDashboard);
router.get('/:id', protect, customerController.getCustomerDetails);

module.exports = router;