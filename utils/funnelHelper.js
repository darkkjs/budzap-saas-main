// utils/funnelHelper.js
const PLAN_LIMITS = {
    gratuito: 1,
    plus: 10,
    premium: 40
};

function getActiveFunnels(user) {
  const limit = PLAN_LIMITS[user.plan];
  return user.funnels.slice(0, limit);
}

module.exports = { getActiveFunnels };