// routes/autoResponse.js

const express = require('express');
const router = express.Router();
const { ensureAuthenticated } = require('../middleware/auth');
const redisClient = require('../config/redisConfig'); // Certifique-se de ter este arquivo configurado
const { AUTO_RESPONSE_LIMITS } = require('../config/planLimits');
const {updateCampaigns, getCampaigns, getAutoResponseReport, getAutoResponseUsage} = require('../controllers/autoResponseController');
const { getActiveFunnels } = require('../utils/funnelHelper');

router.post('/update-campaigns', ensureAuthenticated, updateCampaigns);
router.get('/campaigns/:instanceKey', ensureAuthenticated, getCampaigns);
router.get('/report/:instanceKey', ensureAuthenticated, getAutoResponseReport);
router.get('/usage/:instanceKey', ensureAuthenticated, getAutoResponseUsage);

// Rota para renderizar a página de autoresposta
router.get('/', ensureAuthenticated, async (req, res) => {
    try {
        const userId = req.user.id;
        const userKey = `user:${userId}`;
        const funnelsKey = `user:${userId}:funnels`;

        const [userPlan, funnelIds] = await Promise.all([
            redisClient.hget(userKey, 'plan'),
            redisClient.smembers(funnelsKey)
        ]);

        const funnelsPromises = funnelIds.map(funnelId => 
            redisClient.get(`funnel:${funnelId}`).then(JSON.parse)
        );
        const funnels = await Promise.all(funnelsPromises);

        const activeFunnels = getActiveFunnels(funnels, userPlan);

        res.render('auto-response', { 
            user: req.user, 
            title: 'Configurar Autoresposta - BudZap',
            funnels: activeFunnels,
            AUTO_RESPONSE_LIMITS
        });
    } catch (error) {
        console.error('Erro ao carregar funnels:', error);
        res.status(500).send('Erro ao carregar a página de autoresposta');
    }
});

router.get('/usage', ensureAuthenticated, async (req, res) => {
    try {
        const userId = req.user.id;
        const userKey = `user:${userId}`;
        
        const [userPlan, autoResponseCount] = await Promise.all([
            redisClient.hget(userKey, 'plan'),
            redisClient.hget(userKey, 'autoResponseCount')
        ]);

        const limit = AUTO_RESPONSE_LIMITS[userPlan];
        const usage = parseInt(autoResponseCount) || 0;

        res.json({
            success: true,
            usage: usage,
            limit: limit,
            remaining: Math.max(0, limit - usage)
        });
    } catch (error) {
        console.error('Erro ao obter uso de autoresposta:', error);
        res.status(500).json({ success: false, error: 'Erro ao obter uso de autoresposta' });
    }
});

router.get('/report/:instanceKey', ensureAuthenticated, async (req, res) => {
    try {
        const { instanceKey } = req.params;
        const reportsKey = `auto_response_reports:${instanceKey}`;

        const reports = await redisClient.lrange(reportsKey, 0, -1);
        const parsedReports = reports.map(JSON.parse);

        // Ordena os relatórios por timestamp (do mais recente para o mais antigo)
        const sortedReports = parsedReports.sort((a, b) => b.timestamp - a.timestamp);

        // Pega os 5 relatórios mais recentes
        const recentResponses = sortedReports.slice(0, 5).map(report => ({
            phoneNumber: report.chatId.split('@')[0],
            timestamp: report.timestamp
        }));

        res.json({
            success: true,
            totalResponses: parsedReports.length,
            recentResponses: recentResponses
        });
    } catch (error) {
        console.error('Erro ao gerar relatório:', error);
        res.status(500).json({ success: false, error: 'Erro ao gerar relatório' });
    }
});

module.exports = router;