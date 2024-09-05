const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const chatSchema = new mongoose.Schema({
  chatId: String,
  name: String,
  image: String,
  lastMessage: String,
  autoResponseSent: { type: Boolean, default: false },
  currentStep: { type: Number, default: 0 },
  userInputs: { type: Map, of: String, default: () => new Map() }
});

const whatsappInstanceSchema = new mongoose.Schema({
  name: String,
  key: { type: String, unique: true, required: true },
  autoResponse: {
    isActive: { type: Boolean, default: false },
    funnelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Funnel' }
  },
  autoResponseReports: [{
    chatId: String,
    funnelId: mongoose.Schema.Types.ObjectId,
    timestamp: Date
  }],
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  isConnected: { type: Boolean, default: false },
  whatsappName: String,
  createdAt: { type: Date, default: Date.now },
  chats: [chatSchema],  // Add this line to include chats in the whatsappInstanceSchema
  webhookUrl: String
});

const notificationSchema = new mongoose.Schema({
  title: String,
  content: String,
  icon: String,
  read: { type: Boolean, default: false },
  timestamp: { type: Date, default: Date.now }
});

const stepSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['text', 'image', 'video', 'audio', 'wait', 'conditional', 'input'],
    required: true
  },
  content: String,
  delay: Number,
  condition: String,
  thenContent: String,
  elseContent: String,
  inputKey: String,
  inputPrompt: String
});

const funnelSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  description: String,
  createdAt: { type: Date, default: Date.now },
  steps: [stepSchema]
});


const campaignSchema = new mongoose.Schema({
  name: { type: String, required: true },
  condition: { type: String, enum: ['all', 'startsWith', 'contains', 'equals', 'regex'], required: true },
  value: String,
  funnelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Funnel', required: true },
  isActive: { type: Boolean, default: true },
  activationCount: { type: Number, default: 0 }
});



const UserSchema = new mongoose.Schema({
  name: String,
  email: String,
  phone: {
    type: String,
    unique: true,
    required: true
  },
  username: {
    type: String,
    unique: true,
    required: true
  },
  password: String,
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  manualPlanActive: {
    type: Boolean,
    default: false
  },
  manualPlanValidUntil: Date,

  plan: {
    type: String,
    enum: ['gratuito', 'basico', 'plus', 'premium'],
    default: 'gratuito'
  },
  funnelLimit: {
    type: Number,
    default: 50 // Limite padrão para o plano gratuito
  },
  funnelUsage: {
    type: Number,
    default: 0
  },
  activeFunnels: {
    type: Number,
    default: 0
  },
  autoResponseLimit: {
    type: Number,
    default: 30
  },
  autoResponseCount: {
    type: Number,
    default: 0
  },
  elevenlabsApiKey: {
    type: String,
    default: null
},
elevenlabsVoiceId: {
    type: String,
    default: null
},
autoResponseCampaigns: [campaignSchema],
mercadopago: {
  xCsrfToken: String,
  cookie: String,
  xNewRelicId: String,
  integrationActive: { type: Boolean, default: false }
},
  validUntil: Date,
  stripeCustomerId: String,
  stripeSubscriptionId: String,
  notifications: [notificationSchema],
  whatsappInstances: [whatsappInstanceSchema],
  funnels: [funnelSchema],
  profileImage: {
    type: String,
    default: '/img/profile.jpeg'
  },
});


UserSchema.index({ 'whatsappInstances.key': 1 });
UserSchema.index({ email: 1 });
UserSchema.index({ username: 1 });

UserSchema.pre('save', async function(next) {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  next();
});



UserSchema.methods.isValidAdminPassword = async function(adminPassword) {
  return await bcrypt.compare(adminPassword, this.adminPassword);
};

UserSchema.methods.isValidPassword = async function(password) {
  try {
    return await bcrypt.compare(password, this.password);
  } catch (error) {
    console.error('Erro ao comparar senhas:', error);
    return false;
  }
};

module.exports = mongoose.model('User', UserSchema);