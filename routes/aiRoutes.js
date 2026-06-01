const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const upload = require('../middlewares/upload');

router.post('/scan', upload.single('image'), aiController.scanItem);

module.exports = router;