// routes/someFeature.js

const express = require('express');
const router = express.Router();
const planCheck = require('../middleware/planCheck');

router.get('/premium-feature', planCheck('premium'), (req, res) => {
  // Lógica para a funcionalidade premium
  res.send('Esta é uma funcionalidade premium!');
});

router.get('/plus-feature', planCheck('plus'), (req, res) => {
  // Lógica para a funcionalidade plus
  res.send('Esta é uma funcionalidade plus!');
});

module.exports = router;