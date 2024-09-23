const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    targetId: {
        type: String,
        required: true,
        index: true
    },
    eventType: {
        type: String,
        required: true
    },
    data: {
        type: mongoose.Schema.Types.Mixed
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
});

const Event = mongoose.model('Event', eventSchema);

module.exports = Event;