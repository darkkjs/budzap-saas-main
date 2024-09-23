const express = require('express');
const router = express.Router();
const Event = require('../models/Event');

router.get('/events', async (req, res) => {
    try {
        const { page = 1, limit = 10, eventType, dateFrom, dateTo } = req.query;
        const userId = req.user._id; // Assumindo que você tem um middleware de autenticação

        const query = { userId };

        if (eventType) {
            query.eventType = eventType;
        }

        if (dateFrom || dateTo) {
            query.timestamp = {};
            if (dateFrom) {
                query.timestamp.$gte = new Date(dateFrom);
            }
            if (dateTo) {
                query.timestamp.$lte = new Date(dateTo);
            }
        }

        const events = await Event.find(query)
            .sort({ timestamp: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .exec();

        const count = await Event.countDocuments(query);

        res.json({
            events,
            totalPages: Math.ceil(count / limit),
            currentPage: page
        });
    } catch (error) {
        console.error('Erro ao buscar eventos:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

module.exports = router;