const mongoose = require('mongoose');

const ValidationKeySchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true
  },
  plan: {
    type: String,
    enum: ['plus', 'premium'],
    required: true
  },
  isUsed: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('ValidationKey', ValidationKeySchema);