const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const protect = require('../middlewares/authMiddleware');

router.post('/', protect, orderController.createNewOrder);
router.get('/', protect, orderController.getAllOrders);
router.get('/:id', protect, orderController.getOrderById);

module.exports = router;