// chatRoutes.js
const express = require('express');
const router = express.Router();
const { getChats, getMessages, markChatAsRead, saveMessage } = require('../Helpers/redisHelpers');
const User = require('../models/User'); // Assegure-se de que o caminho para o modelo User está correto
const axios = require("axios")
const { executeFunnel } = require('../services/funnelExecutor');
const redisClient = require('../config/redisConfig');
const funnelController = require('../controllers/funnelController'); // Adicione esta linha no topo do arquivo
const moment = require('moment-timezone');
const AUTO_RESPONSE_EXPIRY = 60 * 60; // 1 hora em segundos


router.get('/', async (req, res) => {
    try {
        // Aqui você pode passar dados adicionais para a view, se necessário
        res.render('chatapp', {
            title: 'HocketZap Chat',
            user: req.user // Assumindo que você está usando algum middleware de autenticação
        });
    } catch (error) {
        console.error('Erro ao renderizar página de chat:', error);
        res.status(500).render('error', { message: 'Erro ao carregar a página de chat' });
    }
});

router.post('/profile-image', async (req, res) => {
  try {
    const { instanceKey, chatId } = req.body;

    if (!instanceKey || !chatId) {
      return res.status(400).json({ error: 'Chave da instância e ID do chat são obrigatórios' });
    }

    const config = {
      method: 'post',
      url: `https://budzap.shop/misc/downProfile?key=${instanceKey}`,
      headers: { 
        'Content-Type': 'application/json'
      },
      data: JSON.stringify({ id: chatId })
    };

    const response = await axios(config);

    if (response.data.error === false && response.data.data) {
      const imageUrl = response.data.data;
      
      // Fazer uma requisição para obter a imagem
      const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
      const imageBuffer = Buffer.from(imageResponse.data, 'binary');
      
      // Enviar a imagem como resposta
      res.set('Content-Type', 'image/jpeg');
      res.send(imageBuffer);
    } else {
      res.status(404).json({ error: 'Imagem de perfil não encontrada' });
    }
  } catch (error) {
    console.error('Erro ao obter imagem de perfil:', error);
    res.status(500).json({ error: 'Erro ao obter imagem de perfil' });
  }
});

router.post('/start-funnel', async (req, res) => {
  try {
    const { funnelId, instanceKey, chatId } = req.body;
    const userId = req.user.id;

    const io = req.app.get('io');

    const emitEvent = (instanceKey, eventName, data) => {
      io.to(instanceKey).emit(eventName, data);
  };

    // Buscar o funil do Redis
    const funnel = await funnelController.getFunnelById(funnelId, userId);

    if (!funnel) {
      return res.status(404).json({ error: 'Funil não encontrado' });
    }

    const autoResponseKey = `auto_response:${instanceKey}:${chatId}`;
    let state = await redisClient.get(autoResponseKey);

    if (state) {
      state = JSON.parse(state);
      if (state.funnelId !== funnelId) {
        state = null;
      }
    }

    if (!state) {
      state = {
        funnelId: funnelId,
        currentNodeId: funnel.nodes[0].id, // Assumindo que o primeiro nó é o inicial
        status: 'in_progress',
        userInputs: {},
        lastMessage: ''
      };
    }

    await redisClient.setex(
      autoResponseKey,
      AUTO_RESPONSE_EXPIRY,
      JSON.stringify(state)
    );

    // Iniciar a execução do funil
    executeFunnel(funnel, chatId, instanceKey, state, emitEvent);

    res.json({ message: 'Funil iniciado com sucesso', currentNodeId: state.currentNodeId });
  } catch (error) {
    console.error('Erro ao iniciar funil:', error);
    res.status(500).json({ error: 'Erro ao iniciar funil' });
  }
});

// Rota para obter as instâncias do usuário
router.get('/instances', async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    const instances = user.whatsappInstances.map(instance => ({
      key: instance.key,
      name: instance.name,
      isConnected: instance.isConnected
    }));
    res.json(user.whatsappInstances);
  } catch (error) {
    console.error('Erro ao buscar instâncias:', error);
    res.status(500).json({ error: 'Erro ao buscar instâncias' });
  }
});

router.get('/chats/:instanceKey', async (req, res) => {
    try {
      const chats = await getChats(req.params.instanceKey);
      
      const formattedChats = chats.map(chat => {
        let parsedInfo;
        try {
          parsedInfo = JSON.parse(chat.info);
        } catch (error) {
         // console.error('Error parsing chat info:', error);
          parsedInfo = {};
        }
  
        return {
          id: chat.id,
          name: chat.name || 'Nome Desconhecido',
          image: chat.image || '',
          lastMessage: chat.lastMessage || '',
          lastMessageTimestamp: chat.lastMessageTimestamp || Date.now(),
          lastMessageType: chat.lastMessageType || 'unknown',
          chatType: chat.id.endsWith('@g.us') ? 'grupo' : 'individual',
          unread: chat.unread === 'true',
          unreadCount: chat.unreadCount || 0,
          participants: parsedInfo.participants || [],
          remetente: parsedInfo.userQueEnviou || "",
        };
      });
  
      res.json(formattedChats);
    } catch (error) {
      console.error('Erro ao buscar chats:', error);
      res.status(500).json({ error: 'Erro ao buscar chats', details: error.message });
    }
  });

// Rota para obter as mensagens de um chat
router.get('/messages/:instanceKey/:chatId', async (req, res) => {
  try {
    const messages = await getMessages(req.params.instanceKey, req.params.chatId);
    res.json(messages);
  } catch (error) {
    console.error('Erro ao buscar mensagens:', error);
    res.status(500).json({ error: 'Erro ao buscar mensagens' });
  }
});




function formatPhoneNumber(num) {
  const cleaned = num.replace(/\D/g, '');
  const ddd = parseInt(cleaned.slice(0, 2));
  if (ddd <= 27) {
    return cleaned.padStart(13, '55'); // Ensure 11 digits for DDD <= 27
  } else {
    return cleaned.padStart(12, '55'); // Ensure 10 digits for DDD > 27
  }
}

async function sendTextMessage(num, msg, instance_key) {
  const formattedNumber = formatPhoneNumber(num);
   if (!formattedNumber) {
     return res.status(400).json({ message: 'Número de telefone inválido.' });
   }

   const numfinal = formattedNumber.startsWith('55') 
     ? await formatarNumeroBrasileiro(formattedNumber)
     : formattedNumber;


  const data = {
    id: numfinal,
    typeId: "user",
    message: msg,
    options: {
      delay: 0,
      replyFrom: ""
    },
    groupOptions: {
      markUser: "ghostMention"
    }
  };

  const config = {
    method: 'post',
    maxBodyLength: Infinity,
    url: `https://budzap.shop/message/text?key=${instance_key}`,
    headers: { 
      'Content-Type': 'application/json', 
      'Authorization': 'Bearer RANDOM_STRING_HERE', 
      'Cookie': 'connect.sid=s%3A4KArPPcKr6RWbooDdCu7FnXQCCJRhiqw.fW4prAd3ch3o4u2TV%2FFTSaCHsZrjVafDr8FhO5rHawA'
    },
    data: data
  };

  try {
    const response = await axios(config);
    console.log('Message sent successfully:', JSON.stringify(response.data));
    return response.data;
  } catch (error) {
    console.error('Error sending message:', error.message);
    throw error;
  }
}





const generateVerificationCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

function formatarNumeroBrasileiro(numero) {
  // Remove todos os caracteres não numéricos
  numero = numero.replace(/\D/g, '');

  // Verifica se o número começa com 55 (DDI do Brasil)
  if (!numero.startsWith('55')) {
    return false;
  }

  // Remove o DDI
  numero = numero.slice(2);

  // Extrai o DDD
  const ddd = parseInt(numero.slice(0, 2));

  // Verifica se o DDD é válido
  if (ddd < 11 || ddd > 99) {
    return false;
  }

  // Aplica as regras de formatação
  if (ddd <= 27) {
    // DDD até 27: deve ter 11 dígitos
    if (numero.length < 11) {
      // Adiciona o 9 se estiver faltando
      numero = numero.slice(0, 2) + '9' + numero.slice(2);
    } else if (numero.length > 11) {
      // Remove dígitos extras
      numero = numero.slice(0, 11);
    }
  } else {
    // DDD 28 ou mais: deve ter 10 dígitos
    if (numero.length > 10) {
      // Remove o 9 extra ou dígitos adicionais
      numero = numero.slice(0, 2) + numero.slice(3).slice(0, 8);
    } else if (numero.length < 10) {
      // Número inválido se tiver menos de 10 dígitos
      return false;
    }
  }

  // Retorna o número formatado com o DDI
  return '55' + numero;
}

function formatPhoneNumber(number) {
  const cleaned = String(number).replace(/\D/g, '');

  if (/^\d{10,15}$/.test(cleaned)) {
    return cleaned;
  }

  const trimmed = cleaned.startsWith('55') ? cleaned.slice(2) : cleaned;

  return /^\d{10,15}$/.test(trimmed) ? trimmed : null;
}


router.post('/send-message', async (req, res) => {
  const { instanceKey, chatId, content } = req.body;
  try {
      // Here you would implement the actual message sending logic
      // using the provided sendTextMessage function or your WhatsApp API
      // For now, we'll just simulate a successful send
      console.log(`Sending message to ${chatId} via instance ${instanceKey}: ${content}`);
      await sendTextMessage(chatId, content, instanceKey)

      const messageData = {
        key: `${chatId}:${Date.now()}`,
        sender: req.user.username, // Assuming you have user info in the request
        content: content,
        timestamp: moment().tz('America/Sao_Paulo').unix(), // Usa o timestamp de São Paulo
        fromMe: true,
        type: 'text',
        senderImage: req.user.profileImage || 'https://cdn-icons-png.flaticon.com/512/4792/4792929.png'
    };

    // Save message to Redis
    await saveMessage(instanceKey, chatId, messageData);


      res.json({ success: true, message: 'Message sent successfully' });
  } catch (error) {
      console.error('Error sending message:', error);
      res.status(500).json({ error: 'Error sending message' });
  }
});

router.post('/mark-as-read/:instanceKey/:chatId', async (req, res) => {
  try {
      await markChatAsRead(req.params.instanceKey, req.params.chatId);
      // Reset unread count in Redis
      await redisClient.hset(`chat:${req.params.instanceKey}:${req.params.chatId}`, 'unreadCount', '0');
      res.status(200).send('Chat marcado como lido');
  } catch (error) {
      console.error('Erro ao marcar chat como lido:', error);
      res.status(500).json({ error: 'Erro ao marcar chat como lido' });
  }
});

// Função para marcar o chat como lido no Redis
router.get('/status', async (req, res) => {
  try {
      const { funnelId, instanceKey, chatId } = req.query;
      const userId = req.user.id;

      // Buscar o funil do Redis
      const funnel = await funnelController.getFunnelById(funnelId, userId);

      if (!funnel) {
          return res.status(404).json({ error: 'Funil não encontrado' });
      }

      const autoResponseKey = `auto_response:${instanceKey}:${chatId}`;
      const stateData = await redisClient.get(autoResponseKey);
      const state = stateData ? JSON.parse(stateData) : null;

      let currentContent = { type: 'text', value: 'Conteúdo não disponível' };
      let currentNode = null;
      if (state && state.currentNodeId) {
          currentNode = funnel.nodes.find(node => node.id === state.currentNodeId);
          if (currentNode) {
              switch (currentNode.type) {
                  case 'message':
                      currentContent = { type: 'text', value: currentNode.data?.message || 'Mensagem não disponível' };
                      break;
                  case 'image':
                      currentContent = { type: 'image', value: currentNode.data?.imageUrl || 'URL da imagem não disponível' };
                      break;
                  case 'video':
                      currentContent = { type: 'video', value: currentNode.data?.videoUrl || 'URL do vídeo não disponível' };
                      break;
                  case 'audio':
                      currentContent = { type: 'audio', value: currentNode.data?.audioUrl || 'URL do áudio não disponível' };
                      break;
                  case 'input':
                      currentContent = { type: 'text', value: currentNode.data?.question || 'Pergunta não disponível' };
                      break;
                  default:
                      currentContent = { type: 'text', value: 'Tipo de conteúdo não reconhecido' };
              }
          }
      }

      const response = {
          totalNodes: funnel.nodes.length,
          currentNodeIndex: currentNode ? funnel.nodes.indexOf(currentNode) + 1 : 0,
          hasInput: funnel.nodes.some(node => node.type === 'input'),
          waitingForInput: state ? state.status === 'waiting_for_input' : false,
          status: state ? state.status : 'not_started',
          currentContent: currentContent
      };

      res.json(response);
  } catch (error) {
      console.error('Erro ao obter status do funil:', error);
      res.status(500).json({ error: 'Erro ao obter status do funil' });
  }
});

module.exports = router;