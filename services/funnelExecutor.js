// services/funnelExecutor.js
const axios = require('axios');
const API_BASE_URL = 'https://budzap.shop';
const ADMIN_TOKEN = 'darklindo'; // Substitua pelo seu token admin real
const redisClient = require('../config/redisConfig');
const User = require('../models/User');
const AUTO_RESPONSE_EXPIRY = 60 * 60; // 1 hora em segundos
const { uploadbase64 } = require('../Helpers/uploader'); // Ajuste o caminho conforme necessário
const github = require('../config/git');
const { getChats, getMessages, markChatAsRead, saveMessage } = require('../Helpers/redisHelpers');

async function saveAutoResponseMessage(instanceKey, chatId, content, type = 'text') {
    const messageKey = `${chatId}:${Date.now()}`;
    const messageData = {
        key: messageKey,
        sender: 'Auto-resposta',
        content: content,
        timestamp: Math.floor(Date.now() / 1000),
        fromMe: true,
        type: type,
            senderImage: 'https://img.freepik.com/vetores-premium/robo-bonito-icon-ilustracao-conceito-de-icone-de-robo-de-tecnologia-isolado-estilo-cartoon-plana_138676-1220.jpg'
    };

    await saveMessage(instanceKey, chatId, messageData);
}

const {
    GoogleGenerativeAI,
    HarmCategory,
    HarmBlockThreshold,
  } = require("@google/generative-ai");
const mercadopago = require('mercadopago');

async function generatePayment(instanceKey, chatId, node) {
    try {
        const user = await User.findOne({ 'whatsappInstances.key': instanceKey });
        const accessToken = user.mercadopago.appAccessToken;

        if (!accessToken) {
            throw new Error('Access Token do Mercado Pago não configurado');
        }

        const client = new mercadopago.MercadoPagoConfig({ accessToken: accessToken });
        const paymentClient = new mercadopago.Payment(client);

        const paymentData = {
            transaction_amount: Number(node.amount),
            description: node.description,
            payment_method_id: 'pix',
            payer: {
                email: `${chatId.split('@')[0]}@customer.com`,
            }
        };

        const payment = await paymentClient.create({ body: paymentData });

        if (!payment || !payment.id) {
            throw new Error('Resposta de pagamento inválida do Mercado Pago');
        }

    

        // Salvar o mapeamento do ID frontend para o ID real do pagamento
        const updatedUser = await User.findOneAndUpdate(
            { 'whatsappInstances.key': instanceKey },
            { $set: { [`paymentMapping.${node.paymentId}`]: payment.id } },
            { new: true, upsert: true }
        );

        console.log(`Mapeamento de pagamento salvo: ${node.paymentId} -> ${payment.id}`);
        console.log('Mapeamento atual:', updatedUser.paymentMapping);


      
        // Enviar o QR code e as instruções de pagamento
        await sendTextMessage(instanceKey, `*Pagamento gerado! Valor: R$ ${node.amount}*`, chatId);
        await sendTextMessage(instanceKey, `${node.description}`, chatId);
        //await sendTextMessage(instanceKey, `ID do Pagamento: ${node.paymentId}`, chatId);
        
        if (payment.point_of_interaction && payment.point_of_interaction.transaction_data) {
            const qrCodeBase64 = payment.point_of_interaction.transaction_data.qr_code_base64;
            const qrCode = payment.point_of_interaction.transaction_data.qr_code;
            if (qrCodeBase64) {
                try {
                    // Usar o uploader para hospedar o QR code no GitHub
                    const qrCodeUrl = await uploadbase64(qrCodeBase64, 'image', github);
                    
                 //   await sendTextMessage(instanceKey, `Escaneie o QR code abaixo para pagar:`, chatId);
                    await sendMediaMessage(instanceKey, qrCodeUrl, chatId, 'imageFile', 'qrcode.jpg', 'Escaneie o QR code para pagar!');
                    await sendTextMessage(instanceKey, `Ou pague com o pix copia e cola:`, chatId);
                } catch (uploadError) {
                    console.error('Erro ao fazer upload do QR code:', uploadError);
                    await sendTextMessage(instanceKey, `Não foi possível gerar o QR code. Por favor, use o código PIX.`, chatId);
                }
            }
            
            if (qrCode) {
                await sendTextMessage(instanceKey, `${qrCode}`, chatId);
            }
        }

        return node.paymentId;
    } catch (error) {
        console.error('Erro ao gerar pagamento:', error);
        throw error;
    }
}

async function checkPayment(instanceKey, frontendPaymentId) {
    try {
        const user = await User.findOne({ 'whatsappInstances.key': instanceKey });
        console.log('Usuário encontrado:', user);
        console.log('Mapeamento de pagamentos:', user.paymentMapping);

        const accessToken = user.mercadopago.appAccessToken;

        if (!accessToken) {
            throw new Error('Access Token do Mercado Pago não configurado');
        }

        // Buscar o ID real do pagamento usando o ID do frontend
        const realPaymentId = user.paymentMapping.get(frontendPaymentId);
        console.log(`ID frontend: ${frontendPaymentId}, ID real: ${realPaymentId}`);

        if (!realPaymentId) {
            throw new Error(`ID de pagamento real não encontrado para o ID frontend: ${frontendPaymentId}`);
        }

        const client = new mercadopago.MercadoPagoConfig({ accessToken: accessToken });
        const paymentClient = new mercadopago.Payment(client);

        const payment = await paymentClient.get({ id: realPaymentId });
        console.log('Resposta da verificação de pagamento:', payment);
        return payment.status === 'approved';
    } catch (error) {
        console.error('Erro ao verificar pagamento:', error);
        throw error;
    }
}

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
        await axios.post(`https://budzap.shop/message/setstatus?key=${instanceKey}`, {
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
        await axios.post('https://budzap.online/group/invite', {
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
       const response = await axios.post('https://budzap.online/group/remove', {
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


function formatAIResponse(response) {
    // Aqui você pode adicionar lógica para formatar a resposta da IA
    // Por exemplo, adicionar emojis, quebras de linha, etc.
    return response
        .replace(/\n/g, '\n\n') // Adiciona uma linha extra entre parágrafos
        .replace(/\*\*(.*?)\*\*/g, '*$1*') // Converte negrito de Markdown para WhatsApp
        .replace(/_(.*?)_/g, '_$1_') // Mantém itálico
        .replace(/`(.*?)`/g, '```$1```'); // Converte código inline para bloco de código no WhatsApp
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

// Inicialize state.variables se ainda não estiver definido
if (!state.variables) {
    state.variables = {};
    state.apiResults = {};
}
        console.log(`Processando nó: ${currentNode.type}`, JSON.stringify(currentNode, null, 2));
        console.log('Estado atual:', JSON.stringify(state, null, 2));


        // Atualiza state.lastMessage com a mensagem mais recente
if (state.status === 'waiting_for_input') {
    state.lastMessage = await redisClient.get(`last_message:${instanceKey}:${chatId}`);
    console.log('Última mensagem recuperada:', state.lastMessage);
}

        try {
            switch (currentNode.type) {
               
    case 'aiAgent':
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
        // Recuperar histórico da memória do Redis
        const memoryKey = `ai_memory:${currentNode.aiMemoryId}`;
        let history = JSON.parse(await redisClient.get(memoryKey)) || [];
    
        // Preparar o prompt substituindo variáveis
        let preparedPrompt = replaceVariables(currentNode.aiPrompt, state);
    
        console.log('Prompt preparado para o agente IA:', preparedPrompt);
    
        // Adicionar a nova mensagem ao histórico
        history.push({ role: "user", parts: [{ text: preparedPrompt }] });
    
        // Iniciar o chat com o histórico
        const chat = model.startChat({ history });
    
        try {
            const result = await chat.sendMessage(preparedPrompt);
            const aiResponse = result.response.text();
    
            console.log('Resposta do agente IA:', aiResponse);
    
            // Adicionar a resposta da IA ao histórico
            history.push({ role: "model", parts: [{ text: aiResponse }] });
    
            // Salvar o histórico atualizado no Redis
            await redisClient.set(memoryKey, JSON.stringify(history));
    
          // Armazenar a resposta da IA nas variáveis do estado usando o shortId
          const shortId = `AI_${currentNode.id.substr(-4)}`;
          state.variables[shortId] = aiResponse;
    
            // Formatar a resposta da IA para envio
            const formattedResponse = formatAIResponse(aiResponse);
    
            // Enviar a resposta formatada
           // await sendTextMessage(instanceKey, formattedResponse, chatId);
        } catch (error) {
            console.error('Erro ao processar resposta do agente IA:', error);
            await sendTextMessage(instanceKey, "Desculpe, ocorreu um erro ao processar sua solicitação.", chatId);
        }
        break;
                case 'randomMessage':
    const randomIndex = Math.floor(Math.random() * currentNode.messages.length);
    await sendTextMessage(instanceKey, currentNode.messages[randomIndex], chatId);
    await saveAutoResponseMessage(instanceKey, chatId, randomMessage, 'text');
    break;
    case 'apiRequest':
        try {
            console.log('Processing API Request node:', currentNode); // Log para debug
            const url = replaceVariables(currentNode.apiUrl, state);
            console.log('Processed URL:', url); // Log para debug
    
            if (!url) {
                throw new Error('URL da API não configurada');
            }
    
            const response = await axios({
                method: currentNode.requestType || 'GET',
                url: url,
                headers: currentNode.headers ? JSON.parse(replaceVariables(JSON.stringify(currentNode.headers), state)) : {},
                data: currentNode.requestBody ? JSON.parse(replaceVariables(currentNode.requestBody, state)) : {}
            });
    
            console.log('API Response:', response.data); // Log para debug
    
            state.apiResults[currentNode.id] = response.data;
            if (currentNode.responseVariable) {
                state.variables[currentNode.responseVariable] = response.data;
            }
        } catch (error) {
            console.error('Erro na requisição API:', error);
            state.apiResults[currentNode.id] = { error: error.message };
        }
        break;

                case 'message':
                    // Verifica se o nó anterior era um input e salva a resposta se necessário
                   // if (state.status === 'waiting_for_input' && state.saveResponse && state.lastMessage) {
                    //    state.userInputs[currentNode.inputKey] = state.lastMessage;
                     //   state.status = 'in_progress';
                  //  }

                    let messageContent = currentNode.content;
                    messageContent = replaceVariables(messageContent, state);
                    await sendTextMessage(instanceKey, messageContent, chatId);
                    await saveAutoResponseMessage(instanceKey, chatId, messageContent, 'text');
                    break;
                    case 'generatePayment':
                        const paymentId = await generatePayment(instanceKey, chatId, currentNode);
                        currentNode.paymentId = paymentId; // Atualizar o nó com o ID do pagamento
                        break;
                        case 'checkPayment':
                            try {
                                if (!currentNode.paymentToCheck) {
                                    throw new Error('Nenhum pagamento selecionado para verificação');
                                }
                                const isPaid = await checkPayment(instanceKey, currentNode.paymentToCheck);
                                const nextConnection2 = funnel.connections.find(conn => 
                                    conn.sourceId === currentNode.id && 
                                    (isPaid ? conn.anchors[0] === 'Right' : conn.anchors[0] === 'Bottom')
                                );
                                state.currentNodeId = nextConnection2 ? nextConnection2.targetId : null;
                            } catch (error) {
                                console.error(`Erro ao processar nó ${currentNode.id}:`, error);
                                await sendTextMessage(instanceKey, `Erro ao verificar pagamento: ${error.message}`, chatId);
                                break;
                            }
                            continue; // Continua para o próximo nó
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
                                await saveAutoResponseMessage(instanceKey, chatId, currentNode.content, 'text');
                                state.status = 'waiting_for_input';
                                state.expectedInput = currentNode.inputKey;
                                await redisClient.setex(autoResponseKey, AUTO_RESPONSE_EXPIRY, JSON.stringify(state));
                                return; // Retorna aqui para esperar a entrada do usuário
                            } else {
                                // Se já recebemos o input, salvamos no estado
                                state.userInputs[currentNode.inputKey] = state.lastMessage;
                                state.status = 'in_progress';
                                console.log(`Resposta do input ${currentNode.inputKey}:`, state.lastMessage);
                            }
                            break;
                    case 'condition':
                        const conditionResult = evaluateCondition(currentNode, state);
                        console.log(`Avaliação da condição: ${conditionResult ? 'Verdadeira' : 'Falsa'}`);
                        const nextConnection = funnel.connections.find(conn => 
                            conn.sourceId === currentNode.id && 
                            (conditionResult ? conn.anchors[0] === 'Right' : conn.anchors[0] === 'Bottom')
                        );
                        state.currentNodeId = nextConnection ? nextConnection.targetId : null;
                        continue;
                case 'wait':
                    const delay = parseInt(currentNode.content) * 1000; // Convertendo para milissegundos
                    console.log(`Aguardando ${delay}ms antes do próximo passo`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    break;
                    case 'image':
                        case 'video':
                            await sendMediaMessage(instanceKey, currentNode.content, chatId, currentNode.type === 'image' ? 'imageFile' : 'video', `${currentNode.type}.${currentNode.type === 'image' ? 'jpg' : 'mp4'}`, currentNode.caption);
                            await saveAutoResponseMessage(instanceKey, chatId, currentNode.content, currentNode.type);
                            break;
                    case 'audio':
                        await sendMediaMessage(instanceKey, currentNode.content, chatId, 'audiofile', 'audio.mp3', '');
                        await saveAutoResponseMessage(instanceKey, chatId, currentNode.content, 'audio');
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

/*/function replaceVariables(content, state) {
    return content.replace(/{{([\w:.]+)}}/g, (match, path) => {
        const [type, key, field] = path.split(':');
        if (type === 'input' && state.userInputs[key]) {
            return state.userInputs[key];
        } else if (type === 'api') {
            if (field && state.variables[`${key}_${field}`]) {
                return state.variables[`${key}_${field}`];
            } else if (state.apiResults[key]) {
                return JSON.stringify(state.apiResults[key]);
            }
        }else if (type === 'ai') {
            // Procura pela variável AI usando o shortId
            const aiValue = Object.entries(state.variables).find(([nodeId, value]) => nodeId.endsWith(key));
            if (aiValue) {
                return aiValue[1];
            }
        } else if (state.variables[key]) {
            return state.variables[key];
        }
        return match; // Retorna o placeholder original se não encontrar um valor
    });
}/*/

function replaceVariables(content, state) {
    if (typeof content !== 'string') {
        console.error('Content is not a string:', content);
        return content;
    }
    return content.replace(/{{([\w:.]+)}}/g, (match, path) => {
        const [type, key, field] = path.split(':');
        console.log('Replacing variable:', { type, key, field, state }); // Log para debug

        if (type === 'input' && state.userInputs && state.userInputs[key]) {
            return state.userInputs[key];
        } else if (type === 'api') {
            if (state.apiResults) {
                // Se não houver um key específico, procure em todos os resultados da API
                for (const apiKey in state.apiResults) {
                    if (state.apiResults[apiKey][field]) {
                        return state.apiResults[apiKey][field];
                    }
                }
            }
            return "Dados não encontrados";
        } else if (type === 'ai') {
            // Procura pela variável AI usando o shortId
            const aiValue = Object.entries(state.variables).find(([nodeId, value]) => nodeId.endsWith(key));
            if (aiValue) {
                return aiValue[1];
            }
        } else if (state.variables && state.variables[key]) {
            return state.variables[key];
        }
        return match; // Retorna o placeholder original se não encontrar um valor
    });
}

function getNestedValue(obj, path) {
    return path.split('.').reduce((prev, curr) => {
        return prev ? prev[curr] : undefined;
    }, obj);
}
function evaluateCondition(conditionNode, state) {
    console.log('Avaliando condição:', JSON.stringify(conditionNode, null, 2));
    console.log('Estado atual:', JSON.stringify(state, null, 2));

    let value;

    if (conditionNode.variable) {
        const [varType, varId] = conditionNode.variable.split(':');
        
        if (varType === 'input') {
            value = state.userInputs[varId];
        } else if (varType === 'api') {
            if (state.apiResults && state.apiResults[varId]) {
                value = state.apiResults[varId];
            }
        } else if (varType === 'ai') {
            // Procura pela variável AI usando o shortId
            const shortId = `AI_${varId.substr(-4)}`;
            value = state.variables[shortId];
        }
    } else if (conditionNode.inputKey) {
        value = state.userInputs[conditionNode.inputKey];
    }

    if (value === undefined) {
        console.log(`Valor não encontrado para a condição: ${conditionNode.variable || conditionNode.inputKey}`);
        return false;
    }

    console.log(`Valor para comparação: "${value}"`);
    
    // Converta o valor e a condição para minúsculas para uma comparação insensível a maiúsculas/minúsculas
    const lowerValue = value.toString().toLowerCase();
    const lowerConditionValue = conditionNode.conditionValue ? conditionNode.conditionValue.toLowerCase() : '';

    switch (conditionNode.conditionType) {
        case 'equals':
            return lowerValue === lowerConditionValue;
        case 'contains':
            return lowerValue.includes(lowerConditionValue);
        case 'startsWith':
            return lowerValue.startsWith(lowerConditionValue);
        case 'endsWith':
            return lowerValue.endsWith(lowerConditionValue);
        case 'containsAny':
            if (Array.isArray(conditionNode.conditionValues)) {
                return conditionNode.conditionValues.some(val => 
                    lowerValue.includes(val.toLowerCase())
                );
            }
            return false;
        default:
            console.log(`Operador desconhecido: ${conditionNode.conditionType}`);
            return false;
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

async function sendMediaMessage(instanceKey, mediaUrl, number, filename, final, caption) {
    let url = `https://budzap.shop/message/${filename}?key=${instanceKey}`
    const mediaBuffer = await downloadMedia(mediaUrl);
    const data = new FormData();
    
    // Salvando o buffer temporariamente como um arquivo
    const tempFilePath = path.join(__dirname, 'temp_' + final);
    fs.writeFileSync(tempFilePath, mediaBuffer);

    // Anexando o arquivo ao FormData
    data.append('file', fs.createReadStream(tempFilePath), final);
    
    data.append('id', `${number}`);

    if (!final.includes('.mp3')) (
        data.append('caption', caption)
    )
  
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