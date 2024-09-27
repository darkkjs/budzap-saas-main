// models/WhatsappCampaign.js
const mongoose = require('mongoose');

const whatsappCampaignSchema = new mongoose.Schema({
  name: { type: String, required: true },
  customPath: { type: String, required: true, unique: true },
  numbers: [{ type: String, required: true }],
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  metaTags: {
    title: String,
    description: String,
    image: String
  },
  redirectType: { type: String, enum: ['single', 'multiple', 'rotative'], default: 'single' },
  messageDelay: { type: Number, default: 0 },
  customMessage: { type: String },
  lastUsedIndex: { type: Number, default: 0 }, // Para o sistema rotativo
  stats: {
    clicks: { type: Number, default: 0 },
    conversions: { type: Number, default: 0 },
    blocks: { type: Number, default: 0 }
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('WhatsappCampaign', whatsappCampaignSchema);