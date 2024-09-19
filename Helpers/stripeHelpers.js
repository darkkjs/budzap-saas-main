// helpers/stripeHelpers.js

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const User = require('../models/User');


const PRICE_TO_PLAN = {
    'price_1Pv8IfJd0dkXl3iIPFkZLOPJ': 'basico',
    'price_1Pzr6UJd0dkXl3iIcRukFSiX': 'plus',
    'price_1Pzr78Jd0dkXl3iIlDGW1Wvf': 'premium'
};

const PLAN_TO_PRICE = {
    'basico': 'price_1Pv8IfJd0dkXl3iIPFkZLOPJ',
    'plus': 'price_1Pzr6UJd0dkXl3iIcRukFSiX',
    'premium': 'price_1Pzr78Jd0dkXl3iIlDGW1Wvf'
};

exports.getPlanFromPriceId = (priceId) => {
    return PRICE_TO_PLAN[priceId] || 'gratuito';
};

exports.getPriceIdFromPlan = (plan) => {
    return PLAN_TO_PRICE[plan];
};

exports.createCheckoutSession = async (userId, plan, successUrl, cancelUrl) => {
    console.log(plan)
    const priceId = await this.getPriceIdFromPlan(plan);
    console.log(priceId)
    if (!priceId) {
        throw new Error('Plano inválido');
    }

    return await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
            {
                price: priceId,
                quantity: 1,
            },
        ],
        mode: 'subscription',
        success_url: successUrl,
        cancel_url: cancelUrl,
        client_reference_id: userId,
    });
};

exports.retrieveSubscription = async (subscriptionId) => {
    return await stripe.subscriptions.retrieve(subscriptionId);
};

exports.handleSuccessfulPayment = async (session) => {
    const userId = session.client_reference_id;
    const user = await User.findById(userId);
  
    if (!user) {
      throw new Error('Usuário não encontrado');
    }
  
    const subscription = await stripe.subscriptions.retrieve(session.subscription);
    const planName = this.getPlanFromPriceId(subscription.items.data[0].price.id);
  
    await User.findByIdAndUpdate(userId, {
      plan: planName,
      stripeCustomerId: session.customer,
      stripeSubscriptionId: session.subscription,
      validUntil: new Date(subscription.current_period_end * 1000),
      $push: {
        notifications: {
          title: `Plano ${planName} ativado`,
          content: 'Sua assinatura foi ativada com sucesso!',
          timestamp: new Date()
        }
      }
    });
  
    await avisar(user.phone, `Parabéns, ${user.name}! Seu plano ${planName} foi ativado com sucesso. Aproveite todos os recursos!`);
  };

// Adicione outras funções relacionadas ao Stripe conforme necessário