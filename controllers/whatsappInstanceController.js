// controllers/whatsappInstanceController.js

const axios = require('axios');
const User = require('../models/User');

const API_BASE_URL = 'https://evolution.hotboard.online';
const APIKEY = 'darkadm';

const PLAN_LIMITS = require('../config/planLimits');

// Função auxiliar para adicionar o apikey ao cabeçalho
const addApiKeyToHeaders = (headers = {}) => {
    return { ...headers, 'apikey': APIKEY };
};


exports.deleteAllInstances = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        
        // Deletar todas as instâncias da API Evolution
        for (const instance of user.whatsappInstances) {
            try {
                await axios.delete(`${API_BASE_URL}/instance/delete/${instance.name}`, {
                    headers: { 
                        'apikey': APIKEY
                    }
                });
            } catch (error) {
                console.error(`Erro ao deletar instância ${instance.name} da API Evolution:`, error);
                // Continua para a próxima instância mesmo se houver erro
            }
        }

        // Limpar todas as instâncias do usuário no banco de dados
        user.whatsappInstances = [];
        await user.save();

        res.json({ message: 'Todas as instâncias foram deletadas com sucesso' });
    } catch (error) {
        console.error('Erro ao deletar todas as instâncias:', error);
        res.status(500).json({ error: 'Erro ao deletar todas as instâncias' });
    }
};

exports.createInstance = async (req, res) => {
    try {
        const { name } = req.body;
        const user = await User.findById(req.user.id);

        // Verificar limite de instâncias baseado no plano
        const userPlan = user.plan || 'gratuito';
        const planLimit = PLAN_LIMITS[userPlan].whatsappConnections;
        const instanceCount = user.whatsappInstances.length;

        if (instanceCount >= planLimit) {
            return res.status(403).json({ 
                error: 'Limite de instâncias atingido para o seu plano.',
                currentPlan: userPlan,
                limit: planLimit,
                currentCount: instanceCount
            });
        }

        let data = JSON.stringify({
            "instanceName": name,
            "qrcode": true,
            "token": "darkadm",
            "integration": "WHATSAPP-BAILEYS",
            
            "webhook": {
                "url": `https://app.hotboard.online/webhook/${name}`,
                "byEvents": false,
                "base64": true,
                "events": [
                    "APPLICATION_STARTUP",
                    "QRCODE_UPDATED",
                    "MESSAGES_SET",
                    "MESSAGES_UPSERT",
                    "MESSAGES_UPDATE",
                    "MESSAGES_DELETE",
                    "SEND_MESSAGE",
                    "CONTACTS_SET",
                    "CONTACTS_UPSERT",
                    "CONTACTS_UPDATE",
                    "PRESENCE_UPDATE",
                    "CHATS_SET",
                    "CHATS_UPSERT",
                    "CHATS_UPDATE",
                    "CHATS_DELETE",
                    "GROUPS_UPSERT",
                    "GROUP_UPDATE",
                    "GROUP_PARTICIPANTS_UPDATE",
                    "CONNECTION_UPDATE",
                    "LABELS_EDIT",
                    "LABELS_ASSOCIATION",
                    "CALL",
                    "TYPEBOT_START",
                    "TYPEBOT_CHANGE_STATUS"
                ]
            }
        });

        let config = {
            method: 'post',
            maxBodyLength: Infinity,
            url: `${API_BASE_URL}/instance/create`,
            headers: { 
                'Content-Type': 'application/json', 
                'apikey': APIKEY
            },
            data : data
        };

        const response = await axios.request(config);

        if (response.data && response.data.hash) {
            user.whatsappInstances.push({ name, key: response.data.hash, user: req.user.id });
            await user.save();
            res.status(201).json({ 
                message: 'Instância criada com sucesso', 
                instance: { name, key: response.data.hash },
                currentCount: instanceCount + 1,
                limit: planLimit
            });
        } else {
            res.status(400).json({ error: 'Falha ao criar instância', details: response.data });
        }
    } catch (error) {
        console.error('Erro ao criar instância:', error.response ? error.response.data : error.message);

        if (error.response && error.response.status === 403) {
            const errorMessage = error.response.data.response && error.response.data.response.message
                ? error.response.data.response.message[0]
                : 'Acesso negado';
            
            res.status(403).json({ 
                error: 'O nome ja está em uso',
                message: errorMessage
            });
        } else {
            res.status(500).json({ 
                error: 'Erro interno do servidor', 
                message: 'Ocorreu um erro ao criar a instância. Por favor, tente novamente.'
            });
        }
    }
};

exports.listInstances = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        
        // Chamar a API externa para buscar as instâncias
        const response = await axios.get(`${API_BASE_URL}/instance/fetchInstances`, {
            headers: addApiKeyToHeaders()
        });

        // Mapear as instâncias retornadas pela API para o formato esperado pelo frontend
        const instancesWithStatus = response.data.map(apiInstance => {
            const userInstance = user.whatsappInstances.find(i => i.key === apiInstance.token);
            
            if (!userInstance) return null; // Ignora instâncias que não pertencem ao usuário

            return {
                _id: userInstance._id, // Mantém o ID do MongoDB
                name: apiInstance.name,
                key: apiInstance.token,
                isConnected: apiInstance.connectionStatus === 'open',
                whatsappName: apiInstance.profileName,
                foto: apiInstance.profilePicUrl,
                number: apiInstance.number,
                createdAt: apiInstance.createdAt,
                updatedAt: apiInstance.updatedAt,
                messageCount: apiInstance._count.Message,
                contactCount: apiInstance._count.Contact,
                chatCount: apiInstance._count.Chat
            };
        }).filter(Boolean); // Remove possíveis valores null

        res.json(instancesWithStatus);
    } catch (error) {
        console.error('Erro ao listar instâncias:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
};

exports.getQRCode = async (req, res) => {
    try {
        const { instanceId } = req.params;
        const user = await User.findById(req.user.id);
        const instance = user.whatsappInstances.id(instanceId);

        if (!instance) {
            return res.status(404).json({ error: 'Instância não encontrada' });
        }

        let config = {
            method: 'get',
            maxBodyLength: Infinity,
            url: `${API_BASE_URL}/instance/connect/${instance.name}`,
            headers: { 
                'apikey': APIKEY
            }
        };

        const response = await axios.request(config);

        if (response.data && response.data.base64) {
            res.json({ 
                pairingCode: response.data.pairingCode,
                code: response.data.code,
                qr: response.data.base64,
                count: response.data.count
            });
        } else {
            res.status(400).json({ error: 'QR Code não disponível' });
        }
    } catch (error) {
        console.error('Erro ao obter QR Code:', error.response ? error.response.data : error.message);
        res.status(500).json({ error: 'Erro ao obter QR Code', details: error.response ? error.response.data : error.message });
    }
};
exports.disconnectInstance = async (req, res) => {
    try {
        const { instanceId } = req.params;
        const user = await User.findById(req.user.id);
        const instance = user.whatsappInstances.id(instanceId);

        if (!instance) {
            return res.status(404).json({ error: 'Instância não encontrada' });
        }

        const response = await axios.delete(`${API_BASE_URL}/instance/logout/${instance.name}`, {
            headers: { 
                'apikey': APIKEY
            }
        });
        
        if (response.status === 200) {
            res.json({ message: 'Instância desconectada com sucesso' });
        } else {
            res.status(400).json({ error: 'Falha ao desconectar instância' });
        }
    } catch (error) {
        console.error('Erro ao desconectar instância:', error);
        res.status(500).json({ error: 'Erro ao desconectar instância' });
    }
};

exports.deleteInstance = async (req, res) => {
    const user = await User.findById(req.user.id);
    const { instanceId } = req.params;
       
    const instance = user.whatsappInstances.id(instanceId);

    try {
        if (!instance) {
            return res.status(404).json({ error: 'Instância não encontrada' });
        }

        const response = await axios.delete(`${API_BASE_URL}/instance/delete/${instance.name}`, {
            headers: { 
                'apikey': APIKEY
            }
        });
        
        if (response.status === 200) {
            user.whatsappInstances.pull(instanceId);
            await user.save();
            res.json({ message: 'Instância deletada com sucesso' });
        } else {
            res.status(400).json({ error: 'Erro ao deletar instância' });
        }
    } catch (error) {
        console.error('Erro ao deletar instância:', error);
        user.whatsappInstances.pull(instanceId);
        await user.save();
        res.json({ message: 'Instância deletada com sucesso localmente, mas houve um erro na API' });
    }
};

exports.checkInstanceStatus = async (req, res) => {
    try {
        const { instanceId } = req.params;
        const user = await User.findById(req.user.id);
        const instance = user.whatsappInstances.id(instanceId);

        if (!instance) {
            return res.status(404).json({ error: 'Instância não encontrada' });
        }

        const response = await axios.get(`${API_BASE_URL}/instance/connectionState/${instance.name}`, {
            headers: { 
                'apikey': APIKEY
            }
        });
        
        if (response.data && response.data.state) {
            res.json({ status: response.data.state === 'open' ? 'connected' : 'disconnected' });
        } else {
            res.status(400).json({ error: 'Falha ao verificar status da instância' });
        }
    } catch (error) {
        console.error('Erro ao verificar status da instância:', error);
        res.status(500).json({ error: 'Erro ao verificar status da instância' });
    }
};