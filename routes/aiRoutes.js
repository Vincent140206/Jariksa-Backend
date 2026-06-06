const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const upload = require('../middlewares/upload');
const protect = require('../middlewares/authMiddleware');
const scanController = require('../controllers/scanController');

router.post('/scan', protect, upload.single('image'), aiController.scanItem);

router.post('/scan-batch', protect, upload.array('images', 5), aiController.scanItems);

router.get('/', protect, scanController.getAllScans);
router.get('/:id', protect, scanController.getScanById);

module.exports = router;