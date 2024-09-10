// services/funnelExecutor.js
const axios = require('axios');
const API_BASE_URL = 'http://localhost:3333';
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


async function executeTyping(instanceKey, chatId, duration) {
     setStatus(instanceKey, 'composing', chatId, duration);
    const delay = parseInt(duration) * 1000; // Convertendo para milissegundos
    console.log(`Aguardando ${delay}ms antes do próximo passo`);
    await new Promise(resolve => setTimeout(resolve, delay));
}

async function executeRecordAudio(instanceKey, chatId, duration) {
    await setStatus(instanceKey, 'recording', chatId, duration);
    const delay = parseInt(duration) * 1000; // Convertendo para milissegundos
    console.log(`Aguardando ${delay}ms antes do próximo passo`);
    await new Promise(resolve => setTimeout(resolve, delay));
}

async function setStatus(instanceKey, status, chatId, duration) {
    try {
        await axios.post(`http://localhost:3333/message/setstatus?key=${instanceKey}`, {
            status: status,
            id: chatId,
            delay: duration * 1000, // Converter segundos para milissegundos
            type: 'user'
        });
        console.log(`Aguardando ${duration * 1000}s antes do próximo passo`);
        
    } catch (error) {
        console.error(`Erro ao definir status ${status}:`, error);
    }
}

async function addToGroup(instanceKey, groupId, userId) {
    try {
        await axios.post('http://localhost:3332/group/invite', {
            instanceKey,
            id: groupId,
            users: [userId]
        });
    } catch (error) {
        console.error('Erro ao adicionar usuário ao grupo:', error);
    }
}

async function removeFromGroup(instanceKey, groupId, userId) {
    try {
       const response = await axios.post('http://localhost:3332/group/remove', {
            instanceKey,
            id: groupId,
            users: [userId]
        });

        console.log(response)
    } catch (error) {
        console.error('Erro ao remover usuário do grupo:', error);
    }
}

async function sendFile(instanceKey, chatId, fileUrl) {
    try {
        // Implemente a lógica para enviar o arquivo usando a API do WhatsApp
        // Você precisará adaptar isso de acordo com a API específica que está usando
    } catch (error) {
        console.error('Erro ao enviar arquivo:', error);
    }
}

async function visualizeMessage(instanceKey, chatId) {
    try {
        // Implemente a lógica para marcar a mensagem como visualizada
        // Você precisará adaptar isso de acordo com a API específica que está usando
    } catch (error) {
        console.error('Erro ao marcar mensagem como visualizada:', error);
    }
}

async function executeFunnel(funnel, chatId, instanceKey, state) {
    console.log('Executando funil:', { funnelName: funnel.name, chatId, instanceKey, currentNodeId: state.currentNodeId });

    const autoResponseKey = `auto_response:${instanceKey}:${chatId}`;

    while (state.currentNodeId) {
        const currentNode = funnel.nodes.find(node => node.id === state.currentNodeId);
        if (!currentNode) {
            console.log(`Nó não encontrado: ${state.currentNodeId}`);
            break;
        }

        console.log(`Processando nó: ${currentNode.type}`, JSON.stringify(currentNode, null, 2));
        console.log('Estado atual:', JSON.stringify(state, null, 2));

        try {
            switch (currentNode.type) {
                case 'message':
                    // Verifica se o nó anterior era um input e salva a resposta se necessário
                    if (state.status === 'waiting_for_input' && state.saveResponse && state.lastMessage) {
                        state.userInputs[state.expectedInput] = state.lastMessage;
                        state.status = 'in_progress';
                    }

                    let messageContent = currentNode.content;
                    // Substituir placeholders com as respostas do usuário
                    const placeholderRegex = /{{(\w+)}}/g;
                    messageContent = messageContent.replace(placeholderRegex, (match, key) => {
                        return state.userInputs[key] || match;
                    });
                    await sendTextMessage(instanceKey, messageContent, chatId);
                    break;

                    case 'typing':
                        await executeTyping(instanceKey, chatId, currentNode.duration);
                        
                        break;
                    case 'recordAudio':
                        await executeRecordAudio(instanceKey, chatId, currentNode.duration);
                        break;
                    case 'addToGroup':
                        await addToGroup(currentNode.instanceKey, currentNode.groupId, chatId);
                        break;
                    case 'removeFromGroup':
                        await removeFromGroup(currentNode.instanceKey, currentNode.groupId, chatId);
                        break;
                    case 'sendFile':
                        await sendFile(instanceKey, chatId, currentNode.fileUrl);
                        break;
                    case 'visualize':
                        await visualizeMessage(instanceKey, chatId);
                        break;

                case 'input':
                    if (state.status !== 'waiting_for_input') {
                        await sendTextMessage(instanceKey, currentNode.content, chatId);
                        state.status = 'waiting_for_input';
                        state.expectedInput = currentNode.inputKey;
                        await redisClient.setex(autoResponseKey, AUTO_RESPONSE_EXPIRY, JSON.stringify(state));
                        return; // Retorna aqui para esperar a entrada do usuário
                    } else {
                        // Se já recebemos o input, simplesmente continuamos para o próximo nó
                        state.status = 'in_progress';
                    }
                    break;
                case 'condition':
                    const conditionResult = evaluateCondition(currentNode, state.userInputs);
                    console.log(`Avaliação da condição: ${conditionResult ? 'Verdadeira' : 'Falsa'}`);
                    const nextConnection = funnel.connections.find(conn => 
                        conn.sourceId === currentNode.id && 
                        (conditionResult ? conn.anchors[0] === 'Right' : conn.anchors[0] === 'Bottom')
                    );
                    state.currentNodeId = nextConnection ? nextConnection.targetId : null;
                    continue; // Continua para o próximo nó
                case 'wait':
                    const delay = parseInt(currentNode.content) * 1000; // Convertendo para milissegundos
                    console.log(`Aguardando ${delay}ms antes do próximo passo`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    break;
                    case 'image':
                        await sendMediaMessage(instanceKey, currentNode.content, chatId, 'imageFile', 'image.jpg', currentNode.caption);
                        break;
                    case 'video':
                        await sendMediaMessage(instanceKey, currentNode.content, chatId, 'video', 'video.mp4', currentNode.caption);
                        break;
                    case 'audio':
                        await sendMediaMessage(instanceKey, currentNode.content, chatId, 'audiofile', 'audio.mp3');
                        break;
                    
                        case 'blockUser':
                            return `<p>Bloquear usuário</p>`;
                        case 'deleteConversation':
                            break;
                      

                default:
                    console.log(`Tipo de nó não suportado: ${currentNode.type}`);
                    break;
            }

            // Encontrar a próxima conexão
            const nextConnection = funnel.connections.find(conn => conn.sourceId === currentNode.id);
            state.currentNodeId = nextConnection ? nextConnection.targetId : null;

            // Atualizar o estado
            await redisClient.setex(autoResponseKey, AUTO_RESPONSE_EXPIRY, JSON.stringify(state));

        } catch (error) {
            console.error(`Erro ao processar nó ${currentNode.id}:`, error);
            break;
        }
    }

    console.log(`Funil concluído para ${chatId}`);
    await redisClient.del(autoResponseKey);
}

function evaluateCondition(conditionNode, userInputs) {
    console.log('Avaliando condição:', JSON.stringify(conditionNode, null, 2));
    console.log('Inputs do usuário:', JSON.stringify(userInputs, null, 2));

    const userInput = userInputs[conditionNode.inputKey];
    if (!userInput) {
        console.log(`Input do usuário não encontrado para a chave: ${conditionNode.inputKey}`);
        return false;
    }

    console.log(`Input do usuário para comparação: "${userInput}"`);

    switch (conditionNode.conditionType) {
        case 'equals':
            return userInput.toLowerCase() === conditionNode.conditionValue.toLowerCase();
        case 'contains':
            return userInput.toLowerCase().includes(conditionNode.conditionValue.toLowerCase());
        case 'startsWith':
            return userInput.toLowerCase().startsWith(conditionNode.conditionValue.toLowerCase());
        case 'endsWith':
            return userInput.toLowerCase().endsWith(conditionNode.conditionValue.toLowerCase());
        default:
            console.log(`Operador desconhecido: ${conditionNode.conditionType}`);
            return false;
    }
}






async function sendTextMessage(instance, content, number) {
    url = `http://localhost:3333/message/text?key=${instance}`
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

async function sendMediaMessage(instanceKey, mediaUrl, number, filename, final, caption = '') {
    let url = `http://localhost:3333/message/${filename}?key=${instanceKey}`
    const mediaBuffer = await downloadMedia(mediaUrl);
    const data = new FormData();
    
    // Salvando o buffer temporariamente como um arquivo
    const tempFilePath = path.join(__dirname, 'temp_' + final);
    fs.writeFileSync(tempFilePath, mediaBuffer);

    // Anexando o arquivo ao FormData
    data.append('file', fs.createReadStream(tempFilePath), final);
    
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