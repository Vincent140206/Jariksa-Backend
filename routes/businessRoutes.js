const express = require('express');
const router = express.Router();
const businessController = require('../controllers/businessController');
const protect = require('../middlewares/authMiddleware');

const multer = require('multer');
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 2 * 1024 * 1024 }
});

router.post('/categories', protect, businessController.createCategory);
router.post('/services', protect, businessController.createService);
router.get('/menu', protect, businessController.fetchMenu);
router.get('/', protect, businessController.fetchProfile);
router.put(
    '/profile/picture',
    authenticateMiddleware,
    upload.single('profile_picture'),
    businessController.uploadStorePicture
);

module.exports = router;