const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema({
  chatId: { type: String, required: true },
  instanceKey: { type: String, required: true },
  name: String,
  image: String,
  lastMessage: String,
  autoResponseSent: { type: Boolean, default: false },
  currentStep: { type: Number, default: 0 },
  userInputs: { type: Map, of: String, default: () => new Map() },
  lastProcessedTimestamp: { type: Number, default: 0 }
});

chatSchema.index({ chatId: 1, instanceKey: 1 }, { unique: true });

const Chat = mongoose.model('Chat', chatSchema);

module.exports = Chat;