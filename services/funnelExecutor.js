// services/funnelExecutor.js
const axios = require('axios');
const API_BASE_URL = 'https://budzap.shop';
const ADMIN_TOKEN = 'darklindo'; // Substitua pelo seu token admin real
const redisClient = require('../config/redisConfig');

const AUTO_RESPONSE_EXPIRY = 60 * 60; // 1 hora em segundos

const addAdminTokenToUrl = (url) => {
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}admintoken=${ADMIN_TOKEN}`;
};

const PLAN_LIMITS = {
    gratuito: 10,
    plus: 200,
    premium: Infinity
};


function wait(delay) {
    return new Promise(resolve => setTimeout(resolve, delay));
}



async function executeFunnel(funnel, chatId, instanceKey, state) {
    console.log('Executando funil:'.cyan, { 
        funnelName: funnel.name, 
        chatId, 
        instanceKey, 
        currentStep: state.currentStep 
    });

   

    const urlMap = {
        text: `${API_BASE_URL}/message/text?key=${instanceKey}`,
        image: `${API_BASE_URL}/message/imageFile?key=${instanceKey}`,
        video: `${API_BASE_URL}/message/video?key=${instanceKey}`,
        audio: `${API_BASE_URL}/message/audiofile?key=${instanceKey}`
    };
    
    if (!funnel || !Array.isArray(funnel.steps) || funnel.steps.length === 0) {
        console.error(`Funil inválido ou vazio para o chat ${chatId}`.red);
        return;
    }

    const autoResponseKey = `auto_response:${instanceKey}:${chatId}`;

    for (let i = state.currentStep; i < funnel.steps.length; i++) {
        const step = funnel.steps[i];
        console.log(`Processando passo ${i + 1} de ${funnel.steps.length}:`.yellow, JSON.stringify(step, null, 2));

        try {
            switch (step.type) {
                case 'text':
                    await sendTextMessage(instanceKey, step.content, chatId);
                    break;
                case 'image':
                    await sendMediaMessage(addAdminTokenToUrl(urlMap.image), step.content, chatId, 'image.jpg', step.caption);
                    break;
                case 'video':
                    await sendMediaMessage(addAdminTokenToUrl(urlMap.video), step.content, chatId, 'video.mp4', step.caption);
                    break;
                case 'audio':
                    await sendMediaMessage(addAdminTokenToUrl(urlMap.audio), step.content, chatId, 'audio.mp3');
                    break;
                case 'wait':
                    console.log(`Aguardando ${step.delay}ms antes do próximo passo`.yellow);
                    await new Promise(resolve => setTimeout(resolve, step.delay));
                    break;
                case 'input':
                    await sendTextMessage(instanceKey, step.inputPrompt, chatId);
                    state.currentStep = i;
                    state.status = 'waiting_for_input';
                    await redisClient.setex(autoResponseKey, AUTO_RESPONSE_EXPIRY, JSON.stringify(state));
                    console.log(`Aguardando input do usuário para o passo ${i + 1}`.cyan);
                    return; // Aguarda input do usuário
                case 'conditional':
                    const condition = evaluateCondition(step.condition, state.userInputs);
                    console.log(`Avaliando condição: ${condition ? 'Verdadeira' : 'Falsa'}`.yellow);
                    if (condition) {
                        await sendTextMessage(instanceKey, step.thenContent, chatId);
                    } else {
                        await sendTextMessage(instanceKey, step.elseContent, chatId);
                    }
                    break;
                default:
                    console.log(`Tipo de passo desconhecido: ${step.type}`.red);
            }
        } catch (error) {
            console.error(`Erro ao processar passo ${i + 1}:`.red, error);
        }

        // Atualiza o estado após cada passo
        state.currentStep = i + 1;
        await redisClient.setex(autoResponseKey, AUTO_RESPONSE_EXPIRY, JSON.stringify(state));
    }

    console.log(`Funil concluído para ${chatId}`.green);
    await redisClient.del(autoResponseKey);
}

async function updateAutoResponseState(instanceKey, chatId, newState) {
    const key = `auto_response:${instanceKey}:${chatId}`;
    console.log(`Atualizando estado da autoresposta para ${key}:`.cyan, JSON.stringify(newState, null, 2));
    await redisClient.setex(key, AUTO_RESPONSE_EXPIRY, JSON.stringify(newState));
}


function evaluateCondition(condition, userInputs) {
    // Implementar a lógica de avaliação da condição
    // Por exemplo:
    // return userInputs[condition.variable] === condition.value;
    return true; // Placeholder
}

async function processStep(step, number, instanceKey) {
    const urlMap = {
        text: `${API_BASE_URL}/message/text?key=${instanceKey}`,
        image: `${API_BASE_URL}/message/imageFile?key=${instanceKey}`,
        video: `${API_BASE_URL}/message/video?key=${instanceKey}`,
        audio: `${API_BASE_URL}/message/audiofile?key=${instanceKey}`
    };

    let url = '';
    let data = new FormData();

    try {
        switch (step.type) {
            case 'text':
                url = addAdminTokenToUrl(urlMap.text);
                await sendTextMessage(instanceKey, step.content, number);
                break;
            case 'image':
                url = addAdminTokenToUrl(urlMap.image);
                await sendMediaMessage(url, step.content, number, 'image.jpg', step.caption);
                break;
            case 'video':
                url = addAdminTokenToUrl(urlMap.video);
                await sendMediaMessage(url, step.content, number, 'video.mp4', step.caption);
                break;
            case 'audio':
                url = addAdminTokenToUrl(urlMap.audio);
                await sendMediaMessage(url, step.content, number, 'audio.mp3');
                break;
            case 'wait':
                await wait(step.delay);
                break;
            default:
                throw new Error(`Unsupported step type: ${step.type}`);
        }
    } catch (error) {
        console.error('Error processing step:', error);
    }
}

async function sendTextMessage(instance, content, number) {
    url = `https://budzap.shop/message/text?key=${instance}`
    const messagePayload = {
        id: `${number}`,
        typeId: "user",
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
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

async function sendMediaMessage(url, mediaUrl, number, filename, caption = '') {
    const mediaBuffer = await downloadMedia(mediaUrl);
    const data = new FormData();
    
    // Salvando o buffer temporariamente como um arquivo
    const tempFilePath = path.join(__dirname, 'temp_' + filename);
    fs.writeFileSync(tempFilePath, mediaBuffer);

    // Anexando o arquivo ao FormData
    data.append('file', fs.createReadStream(tempFilePath), filename);
    
    data.append('id', `${number}`);
    data.append('caption', caption);
    data.append('userType', "user");
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
        fs.unlinkSync(tempFilePath);
    }
}

async function downloadMedia(url) {
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    return Buffer.from(response.data);
}


async function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchFile(url) {
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    return new Blob([response.data]);
}

module.exports = { executeFunnel, sendTextMessage };