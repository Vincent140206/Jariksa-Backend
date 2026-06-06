const express = require('express');
const router = express.Router();
const promoController = require('../controllers/promoController');
const protect = require('../middlewares/authMiddleware');

router.post('/', protect, promoController.addPromo);
router.get('/', protect, promoController.getMyPromos);
router.patch('/:id/status', protect, promoController.updatePromoStatus);

module.exports = router;