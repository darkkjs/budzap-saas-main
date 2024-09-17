const DailyUsage = require('../models/DailyUsage');
const PLAN_LIMITS = require('../config/planLimits');

exports.checkAndUpdateDailyUsage = async (userId, plan, usageType, amount) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let dailyUsage = await DailyUsage.findOne({ userId, date: today });
  if (!dailyUsage) {
    dailyUsage = new DailyUsage({ userId, date: today });
  }

  const dailyLimit = PLAN_LIMITS[plan][`daily${usageType}`];
  const currentUsage = dailyUsage[usageType.toLowerCase()];

  if (currentUsage + amount > dailyLimit) {
    return false; // Limite excedido
  }

  dailyUsage[usageType.toLowerCase()] += amount;
  await dailyUsage.save();
  return true; // Uso atualizado com sucesso
};