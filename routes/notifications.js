// routes/notifications.js
const express = require('express');
const router = express.Router();
const notificationsController = require('../controllers/notificationsController');
const { ensureAuthenticated } = require('../middleware/auth');

router.get('/', ensureAuthenticated, notificationsController.getNotifications);
router.post('/mark-read', ensureAuthenticated, notificationsController.markAsRead);
router.delete('/delete', ensureAuthenticated, notificationsController.deleteNotification);

module.exports = router;
