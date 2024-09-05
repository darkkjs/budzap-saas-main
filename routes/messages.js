const express = require('express');
const router = express.Router();
const { ensureAuthenticated } = require('../middleware/auth');
const { getChats, getMessages } = require('../Helpers/redisHelpers');

// Rota para o aplicativo de chat
router.get('/select', ensureAuthenticated, async (req, res) => {
  try {
    res.render('msg', { 
      user: req.user
    });
  } catch (error) {
    console.error('Erro ao carregar messenger:', error);
    res.status(500).render('error', { message: 'Erro ao carregar o messenger' });
  }
});

router.get('/messenger/:instanceKey', ensureAuthenticated, async (req, res) => {
  try {
    res.render('messages', { 
      user: req.user,
      instanceKey: req.params.instanceKey
    });
  } catch (error) {
    console.error('Erro ao carregar messenger:', error);
    res.status(500).render('error', { message: 'Erro ao carregar o messenger' });
  }
});

router.get('/chats/:instanceKey', ensureAuthenticated, async (req, res) => {
  try {
    const chats = await getChats(req.params.instanceKey);
    const formattedChats = chats.map(chat => ({
      chatId: chat.id,
      name: chat.name,
      image: chat.image,
      lastMessage: chat.lastMessage
    }));
    res.json(formattedChats);
  } catch (error) {
    console.error('Erro ao obter chats:', error);
    res.status(500).json({ error: 'Erro ao obter chats' });
  }
});

router.get('/messages/:instanceKey/:chatId', ensureAuthenticated, async (req, res) => {
  try {
    const messages = await getMessages(req.params.instanceKey, req.params.chatId);
    res.json(messages);
  } catch (error) {
    console.error('Erro ao obter mensagens:', error);
    res.status(500).json({ error: 'Erro ao obter mensagens' });
  }
});

module.exports = router;