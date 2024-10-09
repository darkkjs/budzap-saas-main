const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const { promisify } = require('util');
const unlinkAsync = promisify(fs.unlink);
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const User = require('../models/User');
const { ensureAuthenticated } = require('../middleware/auth');
const { saveMessage } = require('../Helpers/redisHelpers');
const eventBus = require('../Helpers/eventBus');
const moment = require('moment-timezone');
const saoPauloTimezone = 'America/Sao_Paulo';


// Configuração do Multer para upload de arquivos
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'temp/')
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname))
  }
});

const upload = multer({ storage: storage });

// Route for ElevenLabs and WhatsApp integration page
router.get('/elevenlabs-whatsapp', ensureAuthenticated, async (req, res) => {
  try {
    res.render('zapvoice', {
      user: req.user,
      title: 'Integração ElevenLabs e WhatsApp'
    });
  } catch (error) {
    console.error('Error loading integration page:', error);
    res.status(500).render('error', { message: 'Error loading integration page' });
  }
});

const { uploadbase64 } = require('../Helpers/uploader');
const github = require('../config/git');

// Rota para enviar áudio
router.post('/send-audio', ensureAuthenticated, upload.single('audio'), async (req, res) => {
  try {
    const { instanceKey, chatId } = req.body;
    const audioFile = req.file;

    console.log('Arquivo recebido:', audioFile);

    if (!instanceKey || !chatId || !audioFile) {
      return res.status(400).json({ error: 'Parâmetros inválidos' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const instance = user.whatsappInstances.find(inst => inst.name === instanceKey);
    if (!instance) {
      return res.status(404).json({ error: 'Instância do WhatsApp não encontrada' });
    }

    // Ler o arquivo de áudio
    const audioBuffer = await fs.readFile(audioFile.path);
    const audioBase64 = audioBuffer.toString('base64');

    const audiolink =  await uploadbase64(audioBase64, 'audio', github);

    // Preparar os dados para enviar
    const data = JSON.stringify({
      number: chatId,
      audio: audiolink,
      delay: 1200,
      encoding: true
    });

    // Configuração para a requisição
    const config = {
      method: 'post',
      url: `https://api.hocketzap.com/message/sendWhatsAppAudio/${instanceKey}`,
      headers: { 
        'Content-Type': 'application/json', 
        'apikey': "darkadm"
      },
      data: data
    };

    // Enviar o áudio usando a nova API
    const response = await axios(config);

    console.log('Resposta da API:', response.data);

    // Salvar a mensagem no Redis
    const saoPauloTimestamp = moment().tz(saoPauloTimezone).unix();
    const messageData = {
      key: `${chatId}:${Date.now()}`,
      sender: 'Hocketzap',
      content: audiolink,
      timestamp: saoPauloTimestamp,
      fromMe: true,
      type: 'audio',
      senderImage: 'https://img.freepik.com/vetores-premium/robo-bonito-icon-ilustracao-conceito-de-icone-de-robo-de-tecnologia-isolado-estilo-cartoon-plana_138676-1220.jpg'
    };

    await saveMessage(instanceKey, chatId, messageData);

    // Emitir evento para o socket
    eventBus.emit('newMessage', instanceKey, {
      chatId,
      message: messageData
    });

    // Limpar o arquivo temporário
    await fs.unlink(audioFile.path);

    res.json({ success: true, message: 'Áudio enviado com sucesso', data: response.data });
  } catch (error) {
    console.error('Erro ao enviar áudio:', error);
    res.status(500).json({ error: 'Erro ao enviar áudio', details: error.message });
  }
});

module.exports = router;