const mongoose = require('mongoose');

const MassMessageReportSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    funnelName: { type: String, required: true }, // Alterado de funnel para funnelName
    totalNumbers: { type: Number, required: true },
    sent: { type: Number, default: 0 },
    errors: { type: Number, default: 0 },
    startTime: { type: Date, required: true },
    endTime: { type: Date },
    isCompleted: { type: Boolean, default: false }
});

module.exports = mongoose.model('MassMessageReport', MassMessageReportSchema);