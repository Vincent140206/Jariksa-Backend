const express = require('express');
const router = express.Router();
const businessController = require('../controllers/businessController');
const protect = require('../middlewares/authMiddleware');

router.post('/categories', protect, businessController.createCategory);
router.post('/services', protect, businessController.createService);
router.get('/menu', protect, businessController.fetchMenu);

module.exports = router;