const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const unlinkAsync = promisify(fs.unlink);
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const User = require('../models/User');
const { ensureAuthenticated } = require('../middleware/auth');

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

    const instance = user.whatsappInstances.find(inst => inst.key === instanceKey);
    if (!instance) {
      return res.status(404).json({ error: 'Instância do WhatsApp não encontrada' });
    }

    let usrtype = 'user'

    if (chatId.includes("@g.us")) {
        usrtype = 'group'
    }

    // Criar um novo FormData
    const formData = new FormData();
    formData.append('file', fs.createReadStream(audioFile.path), path.basename(audioFile.path));
    formData.append('id', chatId);
    formData.append('userType', usrtype);
    formData.append('delay', '0');

    console.log('Enviando arquivo:', audioFile.path);
console.log(fs.createReadStream(audioFile.path))
    // Enviar o áudio usando a API fornecida
    const response = await axios.post(`https://budzap.shop/message/audiofile?key=${instanceKey}`, formData, {
      headers: {
        ...formData.getHeaders(),
        'accept': '*/*',
        'accept-language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
        'priority': 'u=1, i',
        'sec-ch-ua': '"Not)A;Brand";v="99", "Google Chrome";v="127", "Chromium";v="127"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin',
        'Referer': `https://budzap.shop/chat?num=${chatId}&key=${instanceKey}`,
        'Referrer-Policy': 'strict-origin-when-cross-origin'
      }
    });

    console.log('Resposta da API:', response.data);

    // Limpar o arquivo temporário
    await unlinkAsync(audioFile.path);

    res.json({ success: true, message: 'Áudio enviado com sucesso', data: response.data });
  } catch (error) {
    console.error('Erro ao enviar áudio:', error);
    res.status(500).json({ error: 'Erro ao enviar áudio', details: error.message });
  }
});

module.exports = router;