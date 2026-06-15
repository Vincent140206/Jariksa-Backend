const express = require('express');
const router = express.Router();
const promoController = require('../controllers/promoController');
const protect = require('../middlewares/authMiddleware');

router.post('/', protect, promoController.addPromo);
router.get('/', protect, promoController.getMyPromos);
router.patch('/:id/status', protect, promoController.updatePromoStatus);
router.post('/validate', protect, promoController.validatePromo)
router.post('/send-targeted', protect, promoController.sendTargetedPromo);

module.exports = router;