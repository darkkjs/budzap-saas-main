// models/Funnel.js

const mongoose = require('mongoose');

const stepSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['text', 'image', 'video', 'audio', 'wait', 'conditional'],
    required: true
  },
  content: {
    type: String,
    required: function() { return ['text', 'image', 'video', 'audio'].includes(this.type); }
  },
  delay: {
    type: Number,
    required: function() { return this.type === 'wait'; }
  },
  condition: {
    type: String,
    required: function() { return this.type === 'conditional'; }
  },
  thenContent: {
    type: String,
    required: function() { return this.type === 'conditional'; }
  },
  elseContent: {
    type: String
  }
});

const funnelSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  description: {
    type: String
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  steps: [stepSchema],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Middleware para atualizar o campo updatedAt antes de salvar
funnelSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('Funnel', funnelSchema);