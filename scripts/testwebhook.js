const axios = require('axios');
const { faker } = require('@faker-js/faker');

// Configuração
const WEBHOOK_URL = 'https://budzap.online/app/webhook/dasdaa'; // Ajuste a URL conforme necessário
const NUM_MESSAGES = 5; // Número de mensagens a serem enviadas

// Função para gerar um chat fictício
function generateFakeChat() {
    return {
        chatId: faker.datatype.uuid(),
        name: faker.person.fullName(), // Substituído por fullName
        image: faker.image.avatar()
    };
}

// Função para gerar uma mensagem fictícia
function generateFakeMessage(chat) {
    return {
        chatId: chat.chatId,
        senderName: Math.random() > 0.5 ? chat.name : 'Você',
        content: faker.lorem.sentence(),
        timestamp: faker.date.recent()
    };
}

// Função para enviar uma mensagem para o webhook
async function sendWebhookMessage(chat, message) {
    try {
        const response = await axios.post(WEBHOOK_URL, {
            message: {
                chatId: message.chatId,
                senderName: message.senderName,
                content: message.content,
                timestamp: message.timestamp,
                senderImage: chat.image
            }
        });
        console.log(`Mensagem enviada com sucesso: ${response.status}`);
    } catch (error) {
        console.error('Erro ao enviar mensagem:', error.response ? error.response.data : error.message);
    }
}

// Função principal para executar o teste
async function runTest() {
    const chat = generateFakeChat();
    console.log('Chat gerado:', chat);

    for (let i = 0; i < NUM_MESSAGES; i++) {
        const message = generateFakeMessage(chat);
        console.log(`Enviando mensagem ${i + 1}:`, message);
        await sendWebhookMessage(chat, message);
        // Pequeno delay entre as mensagens para simular tempo real
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
}

// Executar o teste
runTest().then(() => console.log('Teste concluído'));
