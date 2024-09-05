// routes/profile.js
const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profileController');
const { ensureAuthenticated } = require('../middleware/auth');
const upload = require('../middleware/upload'); // Middleware para upload de imagens

router.get('/', ensureAuthenticated, profileController.getProfilePage);
router.post('/update', ensureAuthenticated, profileController.updateProfile);
router.post('/change-password', ensureAuthenticated, profileController.changePassword);
router.post('/update-username', ensureAuthenticated, profileController.updateUsername);
router.post('/upload-image', ensureAuthenticated, upload.single('profileImage'), profileController.uploadProfileImage);

// Na sua rota de perfil (profile.js)
router.post('/verify-password', ensureAuthenticated, profileController.verifyPassword);

module.exports = router;
