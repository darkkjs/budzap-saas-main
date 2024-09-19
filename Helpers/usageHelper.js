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

exports.incrementUsage = async (userId, usageType) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let dailyUsage = await DailyUsage.findOne({ userId, date: today });

  if (!dailyUsage) {
    dailyUsage = new DailyUsage({ userId, date: today });
  }

  dailyUsage[usageType]++;
  await dailyUsage.save();

  return dailyUsage[usageType];
};

exports.checkUsageLimit = async (userId, usageType, plan) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dailyUsage = await DailyUsage.findOne({ userId, date: today });

  if (!dailyUsage) {
    return true; // Ainda não há uso hoje, então está dentro do limite
  }

  const limit = usageType === 'autoResponses' ? AUTO_RESPONSE_LIMITS[plan] : PLAN_LIMITS[plan].funnels;

  return dailyUsage[usageType] < limit;
};

exports.getUserDailyUsage = async (userId) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let dailyUsage = await DailyUsage.findOne({ userId, date: today });

  if (!dailyUsage) {
    dailyUsage = new DailyUsage({ userId, date: today });
    await dailyUsage.save();
  }

  return dailyUsage;
};
