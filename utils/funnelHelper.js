// utils/funnelHelper.js
const PLAN_LIMITS = {
  gratuito: 1,
  plus: 10,
  premium: 40
};

function getActiveFunnels(funnels, userPlan) {
  const limit = PLAN_LIMITS[userPlan];
  return funnels.slice(0, limit);
}

module.exports = { getActiveFunnels };