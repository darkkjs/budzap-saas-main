// models/Product.js
const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  price: { type: Number, required: true },
  description: { type: String },
  redirectLink: { type: String },
  image: { type: String }
});

module.exports = mongoose.model('Product', productSchema);