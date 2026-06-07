const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhookController');

router.post('/midtrans', webhookController.midtransNotification);

module.exports = router;