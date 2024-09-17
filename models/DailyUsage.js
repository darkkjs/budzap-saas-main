const mongoose = require('mongoose');

const dailyUsageSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  spamMessages: {
    type: Number,
    default: 0
  },
  autoResponses: {
    type: Number,
    default: 0
  },
  // Adicione outros campos de uso conforme necessário
}, { timestamps: true });

// Índice composto para busca eficiente
dailyUsageSchema.index({ userId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('DailyUsage', dailyUsageSchema);