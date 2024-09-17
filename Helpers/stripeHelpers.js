// helpers/stripeHelpers.js

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);



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

// Adicione outras funções relacionadas ao Stripe conforme necessário