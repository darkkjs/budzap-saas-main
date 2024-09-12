// controllers/groupController.js

const axios = require('axios');
const User = require('../models/User');

const API_BASE_URL = 'http://localhost:3333'

exports.renderGroupManagementPage = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).populate('whatsappInstances');
        res.render('group-management', { user });
    } catch (error) {
        console.error('Erro ao carregar página de gerenciamento de grupos:', error);
        res.status(500).render('error', { message: 'Erro ao carregar página' });
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
        const response = await axios.get(`${API_BASE_URL}/group/getallgroups`, {
            params: { key: instanceKey }
        });
        res.json(response.data);
    } catch (error) {
        console.error('Erro ao obter grupos:', error);
        res.status(500).json({ error: 'Erro ao obter grupos' });
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