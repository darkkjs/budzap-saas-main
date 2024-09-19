// middleware/autoResponseLimit.js
const User = require('../models/User');
const DailyUsage = require('../models/DailyUsage');
const PLAN_LIMITS = require('../config/planLimits');

async function checkAutoResponseLimit(req, res, next) {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado.'
      });
    }

    const limit = PLAN_LIMITS[user.plan].dailyAutoResponses;

    // Se o plano for premium, não há limite
    if (user.plan === 'premium') {
      return next();
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let dailyUsage = await DailyUsage.findOne({ userId: user._id, date: today });
    if (!dailyUsage) {
      dailyUsage = new DailyUsage({ userId: user._id, date: today, autoResponses: 0 });
      await dailyUsage.save();
    }

    if (dailyUsage.autoResponses >= limit) {
      return res.status(403).json({
        success: false,
        message: 'Limite diário de respostas automáticas atingido. Faça upgrade para continuar.'
      });
    }
    
    next();
  } catch (error) {
    console.error('Erro ao verificar limite de auto-resposta:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno ao verificar limite de auto-resposta.'
    });
  }
}

module.exports = { checkAutoResponseLimit };