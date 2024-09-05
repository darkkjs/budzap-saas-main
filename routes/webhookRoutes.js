const express = require('express');
const router = express.Router();
const { handleWebhook } = require('../controllers/webhookController');

router.post('/pagbank', handleWebhook);

module.exports = router;