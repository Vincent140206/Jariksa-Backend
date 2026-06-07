const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const protect = require('../middlewares/authMiddleware');

router.post('/', protect, orderController.createNewOrder);
router.get('/', protect, orderController.getAllOrders);
router.get('/:id', protect, orderController.getOrderById);
router.post('/:id/pay', protect, orderController.generateOrderPayment)
router.put('/:id/status', protect, orderController.changeStatus);

module.exports = router;