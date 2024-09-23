// models/CommunityFunnel.js
const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

const communityFunnelSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String, required: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    nodes: [{ type: mongoose.Schema.Types.Mixed }],
    connections: [{ type: mongoose.Schema.Types.Mixed }],
    category: { type: String, required: true },
    tags: [{ type: String }],
    downloads: { type: Number, default: 0 },
    comments: [commentSchema],
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    createdAt: { type: Date, default: Date.now },
    price: { type: Number, default: 0 },  // Adicionado campo de preço
    requiredPlan: { type: String, enum: ['', 'basic', 'pro', 'enterprise'], default: '' }  // Adicionado campo de plano requerido
});

communityFunnelSchema.index({ name: 'text', description: 'text', tags: 'text' });

module.exports = mongoose.model('CommunityFunnel', communityFunnelSchema);