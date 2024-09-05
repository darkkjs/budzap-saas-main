// redisHelpers.js
const redisClient = require('../config/redisConfig');

async function saveChat(instanceKey, chatId, chatData) {
    const key = `chat:${instanceKey}:${chatId}`;
    const exists = await redisClient.exists(key);
  
    if (!exists) {
      // Se o chat não existir, cria um novo
      await redisClient.hmset(key, {
        ...chatData,
        info: JSON.stringify(chatData.info || {})
      });
      await redisClient.sadd(`chats:${instanceKey}`, chatId);
    } else {
      // Se o chat já existir, atualiza os campos
      await redisClient.hmset(key, {
        name: chatData.name,
        image: chatData.image,
        info: JSON.stringify(chatData.info || {})
      });
    }
  }
  


  async function getChats(instanceKey) {
    const chatIds = await redisClient.smembers(`chats:${instanceKey}`);
    const chats = await Promise.all(
        chatIds.map(async (chatId) => {
            const chatData = await redisClient.hgetall(`chat:${instanceKey}:${chatId}`);
            return { 
                id: chatId, 
                ...chatData, 
                unreadCount: parseInt(chatData.unreadCount || '0')
            };
        })
    );
    return chats;
}

async function getMessages(instanceKey, chatId, limit = 50) {
  const key = `messages:${instanceKey}:${chatId}`;
  const messages = await redisClient.lrange(key, -limit, -1);
  return messages.map(JSON.parse);
}


async function saveMessage(instanceKey, chatId, messageData) {
    const chatKey = `chat:${instanceKey}:${chatId}`;
    const messagesKey = `messages:${instanceKey}:${chatId}`;
    const messageKeysSet = `messages:${instanceKey}:keys`;
  
    // Verifica se a mensagem já existe
 /*/   const messageExists = await redisClient.sismember(messageKeysSet, messageData.key);
    if (messageExists) {
      console.log('Mensagem duplicada detectada, ignorando.'.yellow);
      return false;
    }/*/
  
    // Verifica se o chat existe
    const chatExists = await redisClient.exists(chatKey);
  
    if (!chatExists) {
      // Se o chat não existir, cria um novo com informações básicas
      await redisClient.hmset(chatKey, {
        name: messageData.sender,
        image: messageData.senderImage,
        info: JSON.stringify(messageData.info || {})
      });
      await redisClient.sadd(`chats:${instanceKey}`, chatId);
    }
  
    // Salva a mensagem na lista de mensagens do chat
    await redisClient.rpush(messagesKey, JSON.stringify(messageData));
  
    // Adiciona a chave da mensagem ao conjunto de chaves de mensagens
    await redisClient.sadd(messageKeysSet, messageData.key);
  
    // Atualiza a última mensagem no chat
    await redisClient.hmset(chatKey, {
      lastMessage: messageData.content,
      lastMessageTimestamp: messageData.timestamp,
      lastMessageType: messageData.type,
      info: JSON.stringify(messageData.info || {})
    });
  
    // Se a mensagem não é do usuário, marca o chat como não lido
    if (!messageData.fromMe) {
        await redisClient.hincrby(chatKey, 'unreadCount', 1);
        await redisClient.hset(chatKey, 'unread', 'true');
    }
  
    console.log(`Mensagem salva para o chat ${chatId}`.green);
    return true;
  }
  
  async function messageExists(instanceKey, messageKey) {
    const messageKeysSet = `messages:${instanceKey}:keys`;
    return await redisClient.sismember(messageKeysSet, messageKey);
  }

  async function updateChatInfo(instanceKey, chatId, chatInfo, messageData) {
    const key = `chat:${instanceKey}:${chatId}`;

    if (!messageData.fromMe) {
        await redisClient.hmset(key, {
            name: chatInfo.name,
            chatType: chatInfo.chatType,
            info: JSON.stringify(chatInfo)
          });
    }

    
  }

  async function markChatAsRead(instanceKey, chatId) {
    
    const chatKey = `chat:${instanceKey}:${chatId}`;
    await redisClient.hset(chatKey, 'unread', '0');
    await redisClient.hset(chatKey, 'unreadCount', '0');
}

module.exports = {
    updateChatInfo,
    messageExists,
    markChatAsRead,
  saveChat,
  saveMessage,
  getChats,
  getMessages,
};