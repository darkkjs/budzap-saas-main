const User = require("../models/User");
const DailyUsage = require('../models/DailyUsage');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { avisar } = require("../Helpers/avisos")

module.exports = {
  ensureAuthenticated: async (req, res, next) => {
    if (req.isAuthenticated()) {
      const user = req.user;
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      let dailyUsage = await DailyUsage.findOne({ userId: user._id, date: today });
      if (!dailyUsage) {
        dailyUsage = new DailyUsage({ userId: user._id, date: today });
        await dailyUsage.save();
      }

      if (user.manualPlanActive && user.validUntil) {
        if (user.validUntil > now) {
          return next();
        } else {
          await updateToFreePlan(user);
          await avisar(req.user.phone, `Ei ${req.user.name}, seu plano manual expirou. Que tal renovar?`);
          return next();
        }
      }
      
      if (user.stripeSubscriptionId) {
        try {
          const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);

          if (subscription.status === 'active') {
            if (subscription.current_period_end * 1000 < now.getTime()) {
              await updateSubscriptionStatus(user, subscription);
            }
          } else {
            await updateToFreePlan(user);
            await avisar(req.user.phone, `Ei ${req.user.name}, sua assinatura do Stripe expirou. Que tal renovar?`);
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
  const newFunnelLimit = 0;
  const newAutoResponseLimit = 0;
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


async function updateSubscriptionStatus(user, subscription) {
  const planName = getPlanNameFromStripePrice(subscription.items.data[0].price.id);
  await User.findByIdAndUpdate(user._id, {
    plan: planName,
    validUntil: new Date(subscription.current_period_end * 1000),
  });
}

function getPlanNameFromStripePrice(priceId) {
  // Mapeie os IDs de preço do Stripe para os nomes dos planos
  const priceToPlans = {
    'price_1Pv8IfJd0dkXl3iIPFkZLOPJ': 'basico',
    'price_1Pzr6UJd0dkXl3iIcRukFSiX': 'plus',
    'price_1Pzr78Jd0dkXl3iIlDGW1Wvf': 'premium'
  };
  return priceToPlans[priceId] || 'gratuito';
}

