const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');
const protect = require('../middlewares/authMiddleware');

router.post('/check', protect, customerController.checkOrAddCustomer);
router.get('/simple', protect, customerController.getCustomers);

router.get('/', protect, customerController.getCustomersDashboard);
router.get('/:id', protect, customerController.getCustomerDetails);

module.exports = router;