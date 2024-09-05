const express = require('express');
const router = express.Router();
const WhatsAppController = require('../controllers/Whatsfunctions');

// Rota para enviar mensagem de texto
router.post('/send-text', async (req, res) => {
    try {
        const { recipientId, message, options } = req.body;
        const result = await WhatsAppController.sendTextMessage(recipientId, message, options);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Rota para enviar mensagem de mídia
router.post('/send-media', async (req, res) => {
    try {
        const { recipientId, type, url, caption, options } = req.body;
        const result = await WhatsAppController.sendMediaMessage(recipientId, type, url, caption, options);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Rota para obter informações do grupo
router.get('/group-info/:groupId', async (req, res) => {
    try {
        const result = await WhatsAppController.getGroupInfo(req.params.groupId);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Rota para criar grupo
router.post('/create-group', async (req, res) => {
    try {
        const { name, users } = req.body;
        const result = await WhatsAppController.createGroup(name, users);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Rota para entrar em um grupo
router.post('/join-group', async (req, res) => {
    try {
        const { url } = req.body;
        const result = await WhatsAppController.joinGroup(url);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Rota para sair de um grupo
router.post('/leave-group', async (req, res) => {
    try {
        const { groupId } = req.body;
        const result = await WhatsAppController.leaveGroup(groupId);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Rota para obter foto de perfil
router.get('/profile-pic/:userId', async (req, res) => {
    try {
        const result = await WhatsAppController.getProfilePic(req.params.userId);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Rota para atualizar foto de perfil
router.post('/update-profile-pic', async (req, res) => {
    try {
        const { imageUrl } = req.body;
        const result = await WhatsAppController.updateProfilePic(imageUrl);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Rota para obter contatos
router.get('/contacts', async (req, res) => {
    try {
        const result = await WhatsAppController.getContacts();
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;