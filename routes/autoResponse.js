// routes/autoResponse.js

const express = require('express');
const router = express.Router();
const { ensureAuthenticated } = require('../middleware/auth');
const User = require('../models/User');
const { getActiveFunnels } = require('../utils/funnelHelper');
const { PLAN_LIMITS, AUTO_RESPONSE_LIMITS } = require('../config/planLimits');
const autoResponseController = require('../controllers/autoResponseController');


router.post('/update-campaigns', ensureAuthenticated, autoResponseController.updateCampaigns);
router.get('/campaigns/:instanceKey', ensureAuthenticated, autoResponseController.getCampaigns);
router.get('/report/:instanceKey', ensureAuthenticated, autoResponseController.getAutoResponseReport);
router.get('/usage/:instanceKey', ensureAuthenticated, autoResponseController.getAutoResponseUsage);


// Rota para renderizar a página de autoresposta
router.get('/', ensureAuthenticated, (req, res) => {
    const activeFunnels = getActiveFunnels(req.user);
    res.render('auto-response', { 
      user: req.user, 
      title: 'Configurar Autoresposta - BudZap',
      funnels: activeFunnels,
      AUTO_RESPONSE_LIMITS
    });
  });


  router.get('/usage', ensureAuthenticated, async (req, res) => {
    const user = await User.findById(req.user._id);
    const limit = AUTO_RESPONSE_LIMITS[user.plan];
    
    res.json({
      success: true,
      usage: user.autoResponseCount,
      limit: limit,
      remaining: Math.max(0, limit - user.autoResponseCount)
    });
  });

router.get('/report/:instanceKey', ensureAuthenticated, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        const instance = user.whatsappInstances.find(inst => inst.key === req.params.instanceKey);

        if (!instance) {
            return res.status(404).json({ success: false, error: 'Instância não encontrada' });
        }

        // Verifica se existe o array autoResponseReports
        if (!instance.autoResponseReports || instance.autoResponseReports.length === 0) {
            return res.json({
                success: true,
                totalResponses: 0,
                recentResponses: []
            });
        }

        // Ordena os relatórios por timestamp (do mais recente para o mais antigo)
        const sortedReports = instance.autoResponseReports.sort((a, b) => b.timestamp - a.timestamp);

        // Pega os 5 relatórios mais recentes
        const recentResponses = sortedReports.slice(0, 5).map(report => ({
            phoneNumber: report.chatId.split('@')[0],
            timestamp: report.timestamp
        }));

        res.json({
            success: true,
            totalResponses: instance.autoResponseReports.length,
            recentResponses: recentResponses
        });
    } catch (error) {
        console.error('Erro ao gerar relatório:', error);
        res.status(500).json({ success: false, error: 'Erro ao gerar relatório' });
    }
});

module.exports = router;