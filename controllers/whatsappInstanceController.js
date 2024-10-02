// controllers/whatsappInstanceController.js

const axios = require('axios');
const User = require('../models/User');

const API_BASE_URL = 'https;//budzap.shop';
const ADMIN_TOKEN = 'darklindo';

const PLAN_LIMITS = require('../config/planLimits');

// Função auxiliar para adicionar o token admin à URL
const addAdminTokenToUrl = (url) => {
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}admintoken=${ADMIN_TOKEN}`;
};

exports.createInstance = async (req, res) => {
    try {
        const { name, key } = req.body;
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

        // Chamar API externa para criar instância
        const response = await axios.post(addAdminTokenToUrl(`${API_BASE_URL}/instance/init`), {
            key: key,
            browser: "Ubuntu",
            webhook: true,
            base64: true,
            webhookUrl: `https://hocketzap.com/webhook/${key}`,
            webhookEvents: ["messages.upsert"],
            ignoreGroups: false,
            messagesRead: false
        });

        if (response.data.error === false) {
            user.whatsappInstances.push({ name, key, user: req.user.id });
            await user.save();
            res.status(201).json({ 
                message: 'Instância criada com sucesso', 
                instance: { name, key },
                currentCount: instanceCount + 1,
                limit: planLimit
            });
        } else {
            res.status(400).json({ error: 'Falha ao criar instância', message: response.data.message });
        }
    } catch (error) {
        console.error('Erro ao criar instância:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
};

// controllers/whatsappInstanceController.js

exports.listInstances = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        const instancesWithStatus = await Promise.all(user.whatsappInstances.map(async (instance) => {
            try {
                const response = await axios.get(addAdminTokenToUrl(`${API_BASE_URL}/instance/info?key=${instance.key}`));
                const isConnected = response.data.error === false && response.data.instance_data.phone_connected;
                const whatsappName = isConnected && response.data.instance_data.user ? response.data.instance_data.user.name : null;
                return {
                    ...instance.toObject(),
                    isConnected,
                    whatsappName
                };
            } catch (error) {
                console.error(`Erro ao verificar status da instância ${instance.key}:`, error);
                return {
                    ...instance.toObject(),
                    isConnected: false,
                    whatsappName: null
                };
            }
        }));
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

        const response = await axios.get(addAdminTokenToUrl(`${API_BASE_URL}/instance/qrbase64?key=${instance.key}`));
   //     console.log(response.data)
        if (response.data.error === false && response.data.qrcode) {
            res.json({ qr: response.data.qrcode });
        } else {
            res.status(400).json({ error: 'QR Code não disponível', message: response.data.message });
        }
    } catch (error) {
        console.error('Erro ao obter QR Code:', error);
        res.status(500).json({ error: 'Erro ao obter QR Code' });
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

        const response = await axios.get(addAdminTokenToUrl(`${API_BASE_URL}/instance/logout?key=${instance.key}`));
        
        if (response.data.error === false) {
            res.json({ message: 'Instância desconectada com sucesso' });
        } else {
            if (response.data.message === "phone isn't connected") {
                res.status(400).json({ error: 'Instância já desconectada', message: 'Esta instância já não tem um WhatsApp conectado.' });
            } else {
                res.status(400).json({ error: 'Falha ao desconectar instância', message: response.data.message });
            }
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

        const response = await axios.get(addAdminTokenToUrl(`${API_BASE_URL}/instance/delete?key=${instance.key}`));
        
        if (response.data.error === false) {
            user.whatsappInstances.pull(instanceId);
            await user.save();
            res.json({ message: 'Instância deletada com sucesso' });
        } else {
            console.log("Erro ao deletar da api")
            user.whatsappInstances.pull(instanceId);
            await user.save();
            res.json({ message: 'Instância deletada com sucesso' });
        }
    } catch (error) {
        console.log("Erro ao deletar da api")
        user.whatsappInstances.pull(instanceId);
        await user.save();
        res.json({ message: 'Instância deletada com sucesso' });
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

        const response = await axios.get(addAdminTokenToUrl(`${API_BASE_URL}/instance/info?key=${instance.key}`));
        
        if (response.data.error === false) {
            res.json({ status: response.data.instance_data.phone_connected ? 'connected' : 'disconnected' });
        } else {
            res.status(400).json({ error: 'Falha ao verificar status da instância', message: response.data.message });
        }
    } catch (error) {
        console.error('Erro ao verificar status da instância:', error);
        res.status(500).json({ error: 'Erro ao verificar status da instância' });
    }
};