const stripe = require('stripe')('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');

const PLANS = {
  basico: { price: '25', name: 'Basico' },
  plus: { price: '45', name: 'Plus' },
  premium: { price: '65', name: 'Premium' }
};

module.exports = { stripe, PLANS };