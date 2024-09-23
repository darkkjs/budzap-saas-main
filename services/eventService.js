const Event = require('../models/Event');

async function saveEvent(userId, targetId, eventType, data = {}) {
    try {
        const newEvent = new Event({
            userId,
            targetId,
            eventType,
            data
        });

        await newEvent.save();
        console.log(`Evento ${eventType} salvo para o usuário ${userId} e alvo ${targetId}`);
        return newEvent;
    } catch (error) {
        console.error('Erro ao salvar evento:', error);
        throw error;
    }
}

async function getEventsByUserAndTarget(userId, targetId) {
    try {
        const events = await Event.find({ userId, targetId }).sort({ timestamp: -1 });
        return events;
    } catch (error) {
        console.error('Erro ao buscar eventos:', error);
        throw error;
    }
}

module.exports = { saveEvent, getEventsByUserAndTarget };