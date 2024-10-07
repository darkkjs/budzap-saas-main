// models/Page.js
const mongoose = require('mongoose');

const sectionSchema = new mongoose.Schema({
    type: String,
    name: String,
    content: String,
    style: mongoose.Schema.Types.Mixed,
    link: String,
    alt: String
});

const pageSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    sections: [sectionSchema],
    customLink: { type: String, unique: true }
});

module.exports = mongoose.model('Page', pageSchema);