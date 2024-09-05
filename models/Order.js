const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  orderId: {
    type: String,
    required: true,
    unique: true
  },
  plan: {
    type: String,
    required: true
  },
  paymentMethod: {
    type: String,
    required: true,
    enum: ['pix', 'credit_card']
  },
  status: {
    type: String,
    required: true,
    enum: ['pending', 'PAID', 'DECLINED', 'CANCELED']
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Order', OrderSchema);