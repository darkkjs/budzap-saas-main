const mongoose = require('mongoose');

const userPurchasedFunnelsSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    funnel: { type: mongoose.Schema.Types.ObjectId, ref: 'CommunityFunnel', required: true },
    purchasedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('UserPurchasedFunnels', userPurchasedFunnelsSchema);