const User = require("../models/User");
const { PLAN_LIMITS, AUTO_RESPONSE_LIMITS } = require('../config/planLimits');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { avisar } = require("../Helpers/avisos")

module.exports = {
  ensureAuthenticated: async (req, res, next) => {
    if (req.isAuthenticated()) {
      const user = req.user;
      const now = new Date();

      if (user.manualPlanActive && user.validUntil) {
        if (user.validUntil > now) {
          // Plano manual ativo e válido
          return next();
        } else {
          // Plano manual expirado
          await updateToFreePlan(user);
          await avisar(req.user.phone, `EIi ${req.user.name}, seu plano acaba de ser expirado, que tal renovar?\n\nChame o gerente para renovar seu plano: 51995746157\n\n*Ou pague pela plataforma e tenha seu plano ativo automaticamente!*`)
          return next();
        }
      }
      
      if (user.stripeSubscriptionId) {
        try {
          const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);

          if (subscription.status !== 'active') {
            await avisar(req.user.phone, `EIi ${req.user.name}, seu plano acaba de ser expirado, que tal renovar?\n\nChame o gerente para renovar seu plano: 51995746157\n\n*Ou pague pela plataforma e tenha seu plano ativo automaticamente!*`)
            await updateToFreePlan(user);
          } else if (subscription.current_period_end * 1000 < now.getTime()) {
            // Subscription has expired, update to free plan
            await avisar(req.user.phone, `EIi ${req.user.name}, seu plano acaba de ser expirado, que tal renovar?\n\nChame o gerente para renovar seu plano: 51995746157\n\n*Ou pague pela plataforma e tenha seu plano ativo automaticamente!*`)
            await updateToFreePlan(user);

          }
        } catch (error) {
          console.error('Error checking subscription status:', error);
          await updateToFreePlan(user);
        }
      } else if (user.validUntil && user.validUntil < now) {
        await updateToFreePlan(user);
      }

      return next();
    }
    res.redirect('https://promocaoagora.store/software/');
  },
  ensureAdmin: (req, res, next) => {
    if (req.isAuthenticated() && req.user.role === 'admin' && req.session.isAdmin) {
      return next();
    }
    res.redirect('/admin/login');
  }
};

async function updateToFreePlan(user) {
  const newFunnelLimit = PLAN_LIMITS['gratuito'];
  const newAutoResponseLimit = AUTO_RESPONSE_LIMITS['gratuito'];
  const newFunnelUsage = Math.min(user.funnelUsage, newFunnelLimit);
  const newAutoResponseCount = Math.min(user.autoResponseCount || 0, newAutoResponseLimit);

  await User.findByIdAndUpdate(user._id, {
    plan: 'gratuito',
    validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    funnelLimit: newFunnelLimit,
    funnelUsage: newFunnelUsage,
    autoResponseLimit: newAutoResponseLimit,
    autoResponseCount: newAutoResponseCount,
    $push: {
      notifications: {
        title: 'Plano Expirado',
        content: 'Seu plano expirou e foi atualizado para o plano gratuito.',
        timestamp: new Date()
      }
    }
  });

  // Update the user in the session
  user.plan = 'gratuito';
  user.validUntil = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
  user.funnelLimit = newFunnelLimit;
  user.funnelUsage = newFunnelUsage;
  user.autoResponseLimit = newAutoResponseLimit;
  user.autoResponseCount = newAutoResponseCount;
  user.notifications.push({
    title: 'Plano Expirado',
    content: 'Seu plano expirou e foi atualizado para o plano gratuito.',
    timestamp: new Date()
  });
}
