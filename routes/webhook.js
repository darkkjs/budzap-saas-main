const express = require('express');
const router = express.Router();
const User = require('../models/User');

const colors = require('colors');
const { saveMessage, messageExists, updateChatInfo } = require('../Helpers/redisHelpers');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const axios = require("axios")
const { uploadbase64 } = require('../Helpers/uploader');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { getChats, chatExists } = require('../Helpers/redisHelpers');
const github = require('../config/git');


async function getChatInfo(event, isGroup) {
  if (isGroup) {
    try {
      const config = {
        method: 'get',
        maxBodyLength: Infinity,
        url: `https://evolution.hotboard.online/group/fetchAllGroups/${event.instance}?getParticipants=false`,
        headers: { 
          'apikey': 'darkadm'
        }
      };

      const response = await axios.request(config);
      const groups = response.data;

      const currentGroup = groups.find(group => group.id === event.data.key.remoteJid);

      if (currentGroup) {
        return {
          userQueEnviou: event.data.pushName,
          name: currentGroup.subject,
          participants: currentGroup.size, // Número de participantes
          chatType: 'grupo',
          owner: currentGroup.owner,
          creation: currentGroup.creation,
          desc: currentGroup.desc,
          restrict: currentGroup.restrict,
          announce: currentGroup.announce
        };
      } else {
        console.warn(`Grupo não encontrado para o JID: ${event.data.key.remoteJid}`);
        return { name: 'Grupo Desconhecido', chatType: 'grupo' };
      }
    } catch (error) {
      console.error('Erro ao buscar informações do grupo:', error);
      return { name: 'Erro ao carregar nome do grupo', chatType: 'grupo' };
    }
  } else {
    return {
      name: event.data.pushName || 'Usuário Desconhecido',
      chatType: 'individual'
    };
  }
}

router.post('/stripe', express.raw({type: 'application/json'}), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
      event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
      return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      await fulfillSubscription(session);
  }

  res.json({received: true});
});


async function sendTextMessage(instance, content, id, type) {
  url = `https://budzap.shop/message/text?key=${instance}`
  const messagePayload = {
      id: `${id}`,
      typeId: type,
      message: content,
      options: {
          delay: 0,
          replyFrom: ""
      },
      groupOptions: {
          markUser: "ghostMention"
      }
  };

console.log(messagePayload);

  const requestOptions = {
      method: 'POST',
      headers: {
          'Content-Type': 'application/json'
      },
      body: JSON.stringify(messagePayload)
  };

  try {
      const response = await fetch(url, requestOptions);
      const data = await response.json();
      console.log('Success');
  } catch (error) {
      console.error('Error:', error);
  }
}

const fs2 = require('fs')
const FormData = require('form-data');

async function sendMediaMessage(instanceKey, mediaUrl, id, filename, final, caption, type) {
  let url = `https://budzap.shop/message/${filename}?key=${instanceKey}`
  const mediaBuffer = await downloadMedia(mediaUrl);
  const data = new FormData();
  
  // Salvando o buffer temporariamente como um arquivo
  const tempFilePath = path.join(__dirname, 'temp_' + final);
  fs2.writeFileSync(tempFilePath, mediaBuffer);

  // Anexando o arquivo ao FormData
  data.append('file', fs2.createReadStream(tempFilePath), final);
  
  data.append('id', `${id}`);

  if (!final.includes('.mp3')) (
      data.append('caption', caption)
  )

  data.append('userType', type);
  data.append('delay', 0);

  try {
      const response = await axios.post(url, data, {
          headers: data.getHeaders()
      });
      
      if (response.data.error) {
          throw new Error(response.data.message);
      }
  } catch (error) {
      console.error('Error sending media message:', error);
  } finally {
      // Removendo o arquivo temporário
      fs2.unlinkSync(tempFilePath);
  }
}

async function downloadMedia(url) {
  const response = await axios.get(url, { responseType: 'arraybuffer' });
  return Buffer.from(response.data);
}


const replaceNewLines = (text) => text.replace(/\n/g, ' ');

router.post('/:instanceKey', async (req, res) => {
  try {
    const maxRetries = 5;
    let retries = 0;
    let success = false;

    while (retries < maxRetries && !success) {
      try {
        const user = await User.findOne({ 'whatsappInstances.name': req.params.instanceKey });
        if (!user) {
          return res.status(404).json({ error: 'Instância não encontrada' });
        }
console.log("Webhook recebido")
        const event = req.body;
        console.log(event)

        if (event.type === 'group-participants') {
          if (event.body.data.action === "add") {
              const newMember = event.body.data.participants[0];
              const groupId = event.body.data.id;
              console.log("Novo membro adicionado: " + newMember);
              try {
                  const user = await User.findOne({ 'whatsappInstances.name': event.instanceKey });
                  if (user) {
                      const instance = user.whatsappInstances.find(inst => inst.name === event.instanceKey);
                      console.log('Instância encontrada:', instance);
                      if (instance && instance.welcomeMessage && instance.welcomeMessage.isActive) {
                          const { message, mediaType, mediaUrl, caption } = instance.welcomeMessage;
                          console.log('Enviando mensagem de boas-vindas para o grupo:', groupId);
                          // Enviar mensagem de boas-vindas
                          if (message) {
                            await sendTextMessage(event.instanceKey, message.replace('{name}', newMember.split('@')[0]), groupId, 'group');
                             
                          }
                          
                          // Enviar mídia, se configurada
                          if (mediaType !== 'none' && mediaUrl) {

                            let typmed;

                            if(mediaType == "image") {
                                typmed = "jpg"
                            } else if (mediaType == "video") {
                                typmed = "mp4"
                            }

                            await sendMediaMessage(
                              event.instanceKey, 
                              mediaUrl, 
                              groupId, 
                              mediaType === 'image' ? 'imageFile' : 'video', 
                              typmed, 
                              caption ? caption.replace('{name}', newMember.split('@')[0]) : 'Usuario', 
                              'group'
                          );
                        }
                      }
                  }
              } catch (error) {
                  console.error('Erro ao enviar mensagem de boas-vindas:', error);
              }
          }
      }

      if (event.event === 'messages.upsert') {
        console.log(`Processando webhook de mensagem para a instancia ${event.instance}`.cyan);
      
        const isGroup = event.data.key.remoteJid.includes("@g.us");
        let chatInfo = await getChatInfo(event, isGroup);
      
        const dadoschat = {
          tipo: isGroup ? 'group' : 'individual',
          info: chatInfo,
          id: event.data.key.remoteJid,
          imagemPerfil: null, // Não temos essa informação na nova estrutura
          pushname: event.data.pushName,
          fromMe: event.data.key.fromMe,
          messageTimestamp: event.data.messageTimestamp,
          mensagem: {
            tipomsg: event.data.messageType,
            conteudomsg: null,
          },
          instancia: event.instance
        };
      
        switch (event.data.messageType) {
          case 'conversation':
            dadoschat.mensagem.tipomsg = 'texto';
            dadoschat.mensagem.conteudomsg = event.data.message.conversation;
            break;
      
            case 'extendedTextMessage':
              dadoschat.mensagem.tipomsg = 'texto';
              dadoschat.mensagem.conteudomsg = event.data.message.extendedTextMessage.text;
              break
    
            case 'imageMessage':
              dadoschat.mensagem.tipomsg = 'image';
              dadoschat.mensagem.conteudomsg = await uploadbase64(event.data.message.base64, 'image', github);
              break
            case 'videoMessage':
              dadoschat.mensagem.tipomsg = 'video';
              dadoschat.mensagem.conteudomsg = await uploadbase64(event.data.message.base64, "video", github);
              break
            case 'audioMessage':
              dadoschat.mensagem.tipomsg = 'audio';
              dadoschat.mensagem.conteudomsg = await uploadbase64(event.data.message.base64, 'audio', github);
              break
            case 'documentMessage':
              dadoschat.mensagem.tipomsg = 'document';
              dadoschat.mensagem.conteudomsg = await uploadbase64(event.data.message.base64, "document", github);
              break;
            case 'stickerMessage':
              dadoschat.mensagem.tipomsg = 'sticker';
              dadoschat.mensagem.conteudomsg = await uploadbase64(event.data.message.base64, 'sticker', github);
              break;


          default:
            dadoschat.mensagem.tipomsg = 'desconhecido';
            dadoschat.mensagem.conteudomsg = 'Tipo de mensagem não suportado';
            break;
        }
      
        console.log("Mensagem recebida: ", dadoschat.mensagem.conteudomsg);
      
        const messageKey = `${dadoschat.id}:${dadoschat.messageTimestamp}`;
      
        const io = req.app.get('io');
        const isNewChat = await checkIfNewChat(event.instance, dadoschat.id);
        if (isNewChat) {
          console.log(`Novo chat detectado: ${dadoschat.id}`);
      
          io.to(event.instance).emit('new chat', {
            id: dadoschat.id,
            name: chatInfo.name,
            lastMessage: dadoschat.mensagem.conteudomsg,
            lastMessageTimestamp: dadoschat.messageTimestamp,
            lastMessageType: dadoschat.mensagem.tipomsg,
            chatType: dadoschat.tipo,
            image: dadoschat.imagemPerfil,
            unreadCount: 1
          });
        }
      
        await saveMessage(event.instance, dadoschat.id, {
          key: messageKey,
          sender: dadoschat.pushname,
          info: chatInfo,
          content: dadoschat.mensagem.conteudomsg,
          timestamp: dadoschat.messageTimestamp,
          fromMe: dadoschat.fromMe,
          type: dadoschat.mensagem.tipomsg,
          senderImage: dadoschat.imagemPerfil
        });
      
        await updateChatInfo(event.instance, dadoschat.id, chatInfo, {
          key: messageKey,
          sender: dadoschat.pushname,
          info: chatInfo,
          content: dadoschat.mensagem.conteudomsg,
          timestamp: dadoschat.messageTimestamp,
          fromMe: dadoschat.fromMe,
          type: dadoschat.mensagem.tipomsg,
          senderImage: dadoschat.imagemPerfil
        });
      
        io.to(event.instance).emit('new message', {
          chatId: dadoschat.id,
          message: {
            key: messageKey,
            sender: dadoschat.pushname,
            info: chatInfo,
            content: dadoschat.mensagem.conteudomsg,
            timestamp: dadoschat.messageTimestamp,
            fromMe: dadoschat.fromMe,
            type: dadoschat.mensagem.tipomsg,
            senderImage: dadoschat.imagemPerfil
          }
        });
      
        // Iniciar a autoresposta
  const {updateCampaigns, getCampaigns, getAutoResponseReport, getAutoResponseUsage, handleAutoResponse} = require('../controllers/autoResponseController');


        if (!dadoschat.id.includes("@g.us")) {
          await handleAutoResponse(
            event.instance,
            dadoschat.id,
            dadoschat.mensagem.conteudomsg,
            "webhook"
          );
        }
      }
      
      async function checkIfNewChat(instanceKey, chatId) {
        return !(await chatExists(instanceKey, chatId));
      }
      
      // Função auxiliar para lidar com a mídia (imagem, áudio, vídeo, sticker)
      async function handleMedia(mediaMessage) {
        // Se a mídia estiver em base64, você pode retorná-la diretamente
        if (mediaMessage.base64) {
          return mediaMessage.base64;
        }
        
        // Se a mídia estiver em uma URL, você pode baixá-la aqui
        if (mediaMessage.url) {
          // Implemente a lógica para baixar a mídia da URL
          // Retorne o conteúdo baixado ou a URL, dependendo de como você quer lidar com isso
          return mediaMessage.url;
        }
      
        // Se não houver base64 nem URL, retorne null ou uma mensagem de erro
        return null;
      }
        success = true;
        console.log(`Evento processado com sucesso para a instância ${req.params.instanceKey}`.green);
        res.status(200).send('Evento processado com sucesso');
      } catch (error) {
        retries++;
        if (retries >= maxRetries) {
          throw error;
        }
        await new Promise(resolve => setTimeout(resolve, 100)); // espera 100ms antes de tentar novamente
      }
    }
  } catch (error) {
    console.error('Erro ao processar evento de webhook:', error);
    res.status(500).json({ error: 'Erro ao processar evento de webhook' });
  }
});

module.exports = router;