async function messageExists(instanceKey, messageKey) {
    const exists = await redisClient.sismember(`messages:${instanceKey}:keys`, messageKey);
    return exists === 1;
}

async function saveMessage(instanceKey, chatId, messageData) {
    const key = `messages:${instanceKey}:${chatId}`;
    await redisClient.rpush(key, JSON.stringify(messageData));
    await redisClient.sadd(`messages:${instanceKey}:keys`, messageData.key);
}

module.exports = {
    saveMessage,
    messageExists,
    // ... outras funções existentes
};