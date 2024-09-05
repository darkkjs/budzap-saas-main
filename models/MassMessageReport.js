// models/MassMessageReport.js
const mongoose = require('mongoose');

const massMessageReportSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    funnel: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Funnel',
        required: true
    },
    totalNumbers: {
        type: Number,
        required: true
    },
    sent: {
        type: Number,
        default: 0
    },
    errors: {
        type: Number,
        default: 0
    },
    startTime: {
        type: Date,
        required: true
    },
    endTime: {
        type: Date
    },
    isCompleted: {
        type: Boolean,
        default: false
    },
    instancesUsed: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'WhatsappInstance'
    }]
});

module.exports = mongoose.model('MassMessageReport', massMessageReportSchema);