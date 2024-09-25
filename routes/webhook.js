const express = require('express');
const router = express.Router();
const User = require('../models/User');

const colors = require('colors');
const { saveMessage, messageExists, updateChatInfo } = require('../Helpers/redisHelpers');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const axios = require("axios")
const { downloadAndSaveMedia } = require('../Helpers/uploader');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

async function getChatInfo(event, isGroup) {
  if (isGroup) {
    try {
      const response = await axios.get(`https://budzap.shop/group/getallgroups`, {
        params: { key: event.instanceKey }
    });
      const groups = response.data;
      //console.log(groups)
      const currentGroup = groups.data[event.body.key.remoteJid];
   //   console.log(currentGroup)
      if (currentGroup) {
        return {
          userQueEnviou: event.body.pushName,
          name: currentGroup.subject,
          participants: currentGroup.participants,
          chatType: 'grupo'
        };
      } else {
        console.warn(`Grupo não encontrado para o JID: ${event.body.key.remoteJid}`);
        return { name: 'Grupo Desconhecido' };
      }
    } catch (error) {
      console.error('Erro ao buscar informações do grupo:', error);
      return { name: 'Erro ao carregar nome do grupo' };
    }
  } else {
    return {
      name: event.body.pushName || 'Usuário Desconhecido',
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

router.post('/:instanceKey', async (req, res) => {
  try {
    const maxRetries = 5;
    let retries = 0;
    let success = false;

    while (retries < maxRetries && !success) {
      try {
        const user = await User.findOne({ 'whatsappInstances.key': req.params.instanceKey });
        if (!user) {
          return res.status(404).json({ error: 'Instância não encontrada' });
        }

        const event = req.body;
        //console.log(event);

        if (event.type === 'message') {
          console.log(`Processando webhook de mensagem para a instancia ${event.instanceKey}`.cyan);

          const isGroup = event.body.key.remoteJid.includes("@g.us");
          let chatInfo = await getChatInfo(event, isGroup);

          const dadoschat = {
            tipo: chatInfo.chatType,
            info: chatInfo,
            id: event.body.key.remoteJid,
            imagemPerfil: event.body.imagemPerfil,
            puhsname: chatInfo.name,
            fromMe: event.body.key.fromMe,
            messageTimestamp: event.body.messageTimestamp,
            mensagem: {
              tipomsg: null,
              conteudomsg: null,
            },
            instancia: event.instanceKey
          };

          const messageType = Object.keys(event.body.message)[0];

          switch (messageType) {
            case 'extendedTextMessage':
              dadoschat.mensagem.tipomsg = 'texto';
              dadoschat.mensagem.conteudomsg = event.body.message.extendedTextMessage.text;
              break
            case 'conversation':
              dadoschat.mensagem.tipomsg = 'texto';
              dadoschat.mensagem.conteudomsg = event.body.message[messageType].text || event.body.message[messageType];
              break;
            case 'imageMessage':
              dadoschat.mensagem.tipomsg = messageType.replace('Message', '');
              dadoschat.mensagem.conteudomsg = await downloadAndSaveMedia(event.body.msgContent, 'jpg');
              break
            case 'videoMessage':
              dadoschat.mensagem.tipomsg = messageType.replace('Message', '');
              dadoschat.mensagem.conteudomsg = await downloadAndSaveMedia(event.body.msgContent, "mp4");
              break
            case 'audioMessage':
              dadoschat.mensagem.tipomsg = messageType.replace('Message', '');
              dadoschat.mensagem.conteudomsg = await downloadAndSaveMedia(event.body.msgContent, 'mp3');
              break
            case 'documentMessage':
              dadoschat.mensagem.tipomsg = messageType.replace('Message', '');
              dadoschat.mensagem.conteudomsg = await downloadAndSaveMedia(event.body.msgContent, "pdf");
              break;
            case 'stickerMessage':
              dadoschat.mensagem.tipomsg = 'sticker';
              dadoschat.mensagem.conteudomsg = await downloadAndSaveMedia(event.body.msgContent, 'jpg');
              break;
            default:
              dadoschat.mensagem.tipomsg = 'texto';
              dadoschat.mensagem.conteudomsg = 'Abra o app para visualizar essa mensagem!';
              break;
          }

          const messageKey = `${dadoschat.id}:${dadoschat.messageTimestamp}`;
       /*/   const exists = await messageExists(req.params.instanceKey, messageKey);
          if (exists) {
            console.log('Mensagem duplicada detectada, ignorando.'.yellow);
            return res.status(200).send('Mensagem duplicada ignorada');
          }/*/

          await saveMessage(req.params.instanceKey, dadoschat.id, {
            key: messageKey,
            sender: dadoschat.puhsname,
            info: chatInfo,
            content: dadoschat.mensagem.conteudomsg,
            timestamp: dadoschat.messageTimestamp,
            fromMe: dadoschat.fromMe,
            type: dadoschat.mensagem.tipomsg,
            senderImage: dadoschat.imagemPerfil
          });

          // Atualizar informações do chat
          await updateChatInfo(req.params.instanceKey, dadoschat.id, chatInfo, {
            key: messageKey,
            sender: dadoschat.puhsname,
            info: chatInfo,
            content: dadoschat.mensagem.conteudomsg,
            timestamp: dadoschat.messageTimestamp,
            fromMe: dadoschat.fromMe,
            type: dadoschat.mensagem.tipomsg,
            senderImage: dadoschat.imagemPerfil
          });

       //   console.log('Mensagem salva:'.green, dadoschat.mensagem.conteudomsg);
         

          //INICIAR A AUTORESPOSTA AQUI:

          
          /*/
          IRA CHAMAR A AUTOREPOSTA COM OS DADOS DO CHAT
          IRA ARMAZENAR AS INFORMAÇÕES COM O REDIS

          IRA AGUENTAR MULTIPLOS CHATS EM MULTIPLAS INTANCIAS DE FORMA FUNCIONAL

          IRA ENVIAR OS FUNIS NA ORDEM CORRETA

          CASO ESTEJA NO SLEEP DO FUNIL (NO PASSO QUYE UTILIZA O AWAIT) E O CLIENTE MANDAR UMA MENSAGEM, IRA IGNORAR A MENSAGEM DELE POIS O FUNIL JA ESTA EM EXECUÇÃO (PARA NO MANDAR O FUNIL DUPLICADO)


          /*/
  // Iniciar a autoresposta
  const {updateCampaigns, getCampaigns, getAutoResponseReport, getAutoResponseUsage, handleAutoResponse} = require('../controllers/autoResponseController');

  if (!dadoschat.id.includes("@g.us")) {
    await handleAutoResponse(
      req.params.instanceKey,
      dadoschat.id,
      dadoschat.mensagem.conteudomsg,
      "webhook"
    );
  
  }
    

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