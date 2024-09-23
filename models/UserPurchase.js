// models/UserPurchase.js
const mongoose = require('mongoose');

const userPurchaseSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    funnelId: { type: mongoose.Schema.Types.ObjectId, ref: 'CommunityFunnel', required: true },
    purchaseDate: { type: Date, default: Date.now },
    price: { type: Number, required: true },
    paymentStatus: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' }
});

module.exports = mongoose.model('UserPurchase', userPurchaseSchema);