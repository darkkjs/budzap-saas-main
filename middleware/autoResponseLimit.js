// middleware/autoResponseLimit.js
const User = require('../models/User');
const { AUTO_RESPONSE_LIMITS } = require('../config/planLimits');

async function checkAutoResponseLimit(req, res, next) {
  const user = await User.findById(req.user._id);
  const limit = AUTO_RESPONSE_LIMITS[user.plan];

  if (user.autoResponseCount >= limit) {
    return res.status(403).json({
      success: false,
      message: 'Limite de respostas automáticas atingido. Faça upgrade para continuar.'
    });
  }
  next();
}

module.exports = { checkAutoResponseLimit };