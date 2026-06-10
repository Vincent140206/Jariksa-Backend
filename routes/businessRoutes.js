const express = require('express');
const router = express.Router();
const businessController = require('../controllers/businessController');
const protect = require('../middlewares/authMiddleware');

router.post('/categories', protect, businessController.createCategory);
router.post('/services', protect, businessController.createService);
router.get('/menu', protect, businessController.fetchMenu);
router.get('/', protect, businessController.fetchProfile);
router.post('/profile', protect, businessController.uploadStorePicture);

module.exports = router;