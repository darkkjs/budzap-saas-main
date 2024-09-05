const express = require('express');
const router = express.Router();
const { ensureAuthenticated } = require('../middleware/auth');
const User = require('../models/User');

router.get('/', ensureAuthenticated, async (req, res) => {
  res.render('dashboard', { user: req.user });
});

module.exports = router;