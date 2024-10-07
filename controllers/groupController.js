// controllers/groupController.js

const axios = require('axios');
const User = require('../models/User');

const API_BASE_URL = 'https://budzap.shop'

exports.renderGroupManagementPage = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).populate('whatsappInstances');
        res.render('group-management', { user });
    } catch (error) {
        console.error('Erro ao carregar página de gerenciamento de grupos:', error);
        res.status(500).render('error', { message: 'Erro ao carregar página' });
    }
};

// Em groupController.js, adicione:

exports.setWelcomeMessage = async (req, res) => {
    const { instanceKey, groupId, isActive, message, mediaType, mediaUrl, caption } = req.body;
    try {
        const user = await User.findOne({ 'whatsappInstances.name': instanceKey });
        if (!user) {
            return res.status(404).json({ error: 'Instância não encontrada' });
        }

        const instance = user.whatsappInstances.find(inst => inst.key === instanceKey);
        if (!instance) {
            return res.status(404).json({ error: 'Instância não encontrada' });
        }

        instance.welcomeMessage = {
            isActive,
            message,
            mediaType,
            mediaUrl,
            caption
        };

        await user.save();

        res.json({ success: true, message: 'Mensagem de boas-vindas configurada com sucesso' });
    } catch (error) {
        console.error('Erro ao configurar mensagem de boas-vindas:', error);
        res.status(500).json({ error: 'Erro ao configurar mensagem de boas-vindas' });
    }
};

exports.getWelcomeMessageSettings = async (req, res) => {
    const { instanceKey, groupId } = req.query;
    try {
        const user = await User.findOne({ 'whatsappInstances.name': instanceKey });
        if (!user) {
            return res.status(404).json({ error: 'Instância não encontrada' });
        }

        const instance = user.whatsappInstances.find(inst => inst.key === instanceKey);
        if (!instance) {
            return res.status(404).json({ error: 'Instância não encontrada' });
        }

        const welcomeMessage = instance.welcomeMessage || {
            isActive: false,
            message: '',
            mediaType: 'none',
            mediaUrl: '',
            caption: ''
        };

        res.json({ success: true, settings: welcomeMessage });
    } catch (error) {
        console.error('Erro ao buscar configurações de boas-vindas:', error);
        res.status(500).json({ error: 'Erro ao buscar configurações de boas-vindas' });
    }
};

exports.createGroup = async (req, res) => {
    const { instanceKey, name, users } = req.body;
    try {
        const response = await axios.post(`${API_BASE_URL}/group/create`, {
            name,
            users
        }, {
            params: { key: instanceKey }
        });
        res.json(response.data);
    } catch (error) {
        console.error('Erro ao criar grupo:', error);
        res.status(500).json({ error: 'Erro ao criar grupo' });
    }
};

exports.getAllGroups = async (req, res) => {
    const { instanceKey } = req.query;
    try {
        console.log('Buscando grupos para a instância:', instanceKey);
        const response = await axios.get(`${API_BASE_URL}/group/getallgroups`, {
            params: { key: instanceKey }
        });
        console.log('Resposta da API externa:', response.data);
        res.json(response.data);
    } catch (error) {
        console.error('Erro ao obter grupos:', error.response ? error.response.data : error.message);
        res.status(500).json({ error: 'Erro ao obter grupos', details: error.message });
    }
};

exports.leaveGroup = async (req, res) => {
    const { instanceKey, id } = req.body;
    try {
        const response = await axios.post(`${API_BASE_URL}/group/leave`, {
            id
        }, {
            params: { key: instanceKey }
        });
        res.json(response.data);
    } catch (error) {
        console.error('Erro ao sair do grupo:', error);
        res.status(500).json({ error: 'Erro ao sair do grupo' });
    }
};

exports.joinGroupFromUrl = async (req, res) => {
    const { instanceKey, url } = req.body;
    try {
        const response = await axios.post(`${API_BASE_URL}/group/join`, {
            url
        }, {
            params: { key: instanceKey }
        });
        res.json(response.data);
    } catch (error) {
        console.error('Erro ao entrar no grupo:', error);
        res.status(500).json({ error: 'Erro ao entrar no grupo' });
    }
};

exports.inviteUser = async (req, res) => {
    const { instanceKey, id, users } = req.body;
    try {
        const response = await axios.post(`${API_BASE_URL}/group/inviteuser`, {
            id,
            users
        }, {
            params: { key: instanceKey }
        });
        res.json(response.data);
    } catch (error) {
        console.error('Erro ao convidar usuário:', error);
        res.status(500).json({ error: 'Erro ao convidar usuário' });
    }
};

exports.removeUser = async (req, res) => {
    const { instanceKey, id, users } = req.body;
    try {
        const response = await axios.post(`${API_BASE_URL}/group/removeuser`, {
            id,
            users
        }, {
            params: { key: instanceKey }
        });
        res.json(response.data);
    } catch (error) {
        console.error('Erro ao remover usuário:', error);
        res.status(500).json({ error: 'Erro ao remover usuário' });
    }
};

exports.makeAdmin = async (req, res) => {
    const { instanceKey, id, users } = req.body;
    try {
        const response = await axios.post(`${API_BASE_URL}/group/makeadmin`, {
            id,
            users
        }, {
            params: { key: instanceKey }
        });
        res.json(response.data);
    } catch (error) {
        console.error('Erro ao promover usuário a admin:', error);
        res.status(500).json({ error: 'Erro ao promover usuário a admin' });
    }
};

exports.demoteAdmin = async (req, res) => {
    const { instanceKey, id, users } = req.body;
    try {
        const response = await axios.post(`${API_BASE_URL}/group/demoteadmin`, {
            id,
            users
        }, {
            params: { key: instanceKey }
        });
        res.json(response.data);
    } catch (error) {
        console.error('Erro ao rebaixar admin:', error);
        res.status(500).json({ error: 'Erro ao rebaixar admin' });
    }
};

exports.getInviteCode = async (req, res) => {
    const { instanceKey, id } = req.query;
    try {
        const response = await axios.post(`${API_BASE_URL}/group/getinvitecode`, {
            id
        }, {
            params: { key: instanceKey }
        });
        res.json(response.data);
    } catch (error) {
        console.error('Erro ao obter código de convite:', error);
        res.status(500).json({ error: 'Erro ao obter código de convite' });
    }
};

exports.getGroupInfoFromUrl = async (req, res) => {
    const { instanceKey, url } = req.query;
    try {
        const response = await axios.post(`${API_BASE_URL}/group/groupurlinfo`, {
            url
        }, {
            params: { key: instanceKey }
        });
        res.json(response.data);
    } catch (error) {
        console.error('Erro ao obter informações do grupo pela URL:', error);
        res.status(500).json({ error: 'Erro ao obter informações do grupo' });
    }
};

exports.getGroupInfoFromId = async (req, res) => {
    const { instanceKey, id } = req.query;
    try {
        const response = await axios.post(`${API_BASE_URL}/group/groupidinfo`, {
            id
        }, {
            params: { key: instanceKey }
        });
        res.json(response.data);
    } catch (error) {
        console.error('Erro ao obter informações do grupo pelo ID:', error);
        res.status(500).json({ error: 'Erro ao obter informações do grupo' });
    }
};

exports.updateGroupSettings = async (req, res) => {
    const { instanceKey, id, action } = req.body;
    try {
        const response = await axios.post(`${API_BASE_URL}/group/settingsupdate`, {
            id,
            action
        }, {
            params: { key: instanceKey }
        });
        res.json(response.data);
    } catch (error) {
        console.error('Erro ao atualizar configurações do grupo:', error);
        res.status(500).json({ error: 'Erro ao atualizar configurações do grupo' });
    }
};

exports.updateGroupSubject = async (req, res) => {
    const { instanceKey, id, subject } = req.body;
    try {
        const response = await axios.post(`${API_BASE_URL}/group/updatesubject`, {
            id,
            subject
        }, {
            params: { key: instanceKey }
        });
        res.json(response.data);
    } catch (error) {
        console.error('Erro ao atualizar assunto do grupo:', error);
        res.status(500).json({ error: 'Erro ao atualizar assunto do grupo' });
    }
};

exports.updateGroupDescription = async (req, res) => {
    const { instanceKey, id, description } = req.body;
    try {
        const response = await axios.post(`${API_BASE_URL}/group/updatedescription`, {
            id,
            description
        }, {
            params: { key: instanceKey }
        });
        res.json(response.data);
    } catch (error) {
        console.error('Erro ao atualizar descrição do grupo:', error);
        res.status(500).json({ error: 'Erro ao atualizar descrição do grupo' });
    }
};