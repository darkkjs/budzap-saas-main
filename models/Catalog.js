// models/Catalog.js
const mongoose = require('mongoose');

const sectionSchema = new mongoose.Schema({
  type: String,
  content: mongoose.Schema.Types.Mixed,
  style: mongoose.Schema.Types.Mixed
});

const catalogSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  description: { type: String },
  sections: [sectionSchema],
  products: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
  customLink: { type: String, unique: true },
  customCSS: String,
  customJS: String
});

module.exports = mongoose.model('Catalog', catalogSchema);