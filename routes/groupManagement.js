// routes/groupManagement.js

const express = require('express');
const router = express.Router();
const groupController = require('../controllers/groupController');
const { ensureAuthenticated } = require('../middleware/auth');
const axios = require("axios")

router.get('/', ensureAuthenticated, groupController.renderGroupManagementPage);
router.post('/create', ensureAuthenticated, groupController.createGroup);
router.get('/all', ensureAuthenticated, groupController.getAllGroups);
router.post('/leave', ensureAuthenticated, groupController.leaveGroup);
router.post('/join', ensureAuthenticated, groupController.joinGroupFromUrl);
router.post('/invite', groupController.inviteUser);
router.post('/remove', groupController.removeUser);
router.post('/make-admin', ensureAuthenticated, groupController.makeAdmin);
router.post('/demote-admin', ensureAuthenticated, groupController.demoteAdmin);
router.get('/invite-code', ensureAuthenticated, groupController.getInviteCode);
router.get('/url-info', ensureAuthenticated, groupController.getGroupInfoFromUrl);
router.get('/id-info', ensureAuthenticated, groupController.getGroupInfoFromId);
router.post('/update-settings', ensureAuthenticated, groupController.updateGroupSettings);
router.post('/update-subject', ensureAuthenticated, groupController.updateGroupSubject);
router.post('/update-description', ensureAuthenticated, groupController.updateGroupDescription);


async function extractGroupMembers(instanceKey, groupId) {
    const API_BASE_URL = 'https://budzap.shop';
    const ADMIN_TOKEN = 'darklindo';

    try {
        const response = await axios.post(`${API_BASE_URL}/group/groupidinfo`, 
            {
                id: groupId
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${ADMIN_TOKEN}`
                },
                params: {
                    key: instanceKey
                }
            }
        );

        if (response.data.error) {
            throw new Error(response.data.message || 'Erro ao obter informações do grupo');
        }

        const groupInfo = response.data.data;
        if (!groupInfo || !groupInfo.participants) {
            throw new Error('Informações do grupo não encontradas ou formato inválido');
        }

        // Extrair apenas os IDs dos participantes
        const members = groupInfo.participants.map(participant => participant.id);

        return members;
    } catch (error) {
        console.error('Erro ao extrair membros do grupo:', error);
        throw error;
    }
}

router.get('/extract-members', async (req, res) => {
    try {
        const { instanceKey, id } = req.query;
        // Lógica para extrair membros do grupo
        const members = await extractGroupMembers(instanceKey, id);
        res.json({ error: false, data: members });
    } catch (error) {
        console.error('Erro ao extrair membros:', error);
        res.status(500).json({ error: true, message: 'Falha ao extrair membros do grupo' });
    }
});

module.exports = router;