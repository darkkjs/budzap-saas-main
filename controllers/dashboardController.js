// controllers/dashboardController.js

const User = require('../models/User'); // Ajuste o caminho conforme necessário
const PLAN_LIMITS = require('../config/planLimits');
const DailyUsage = require('../models/DailyUsage');

exports.getDashboard = async (req, res) => {
  try {
    if (!req.user) {
      console.log('User is undefined in dashboard route');
      return res.redirect('https://promocaoagora.store/software/');
    }
    console.log('Rendering dashboard for user:', req.user.username);

    let statusMessage = '';
    if (req.query.status === 'success') {
      statusMessage = 'Sua assinatura foi ativada com sucesso!';
    } else if (req.query.status === 'error') {
      statusMessage = 'Houve um problema ao processar sua assinatura. Por favor, entre em contato com o suporte.';
    }

    // Aqui você pode adicionar lógica para buscar dados adicionais necessários para o dashboard
    // Por exemplo, estatísticas de uso, informações da assinatura, etc.
  
    const user = req.user;
    const userLimits = PLAN_LIMITS[user.plan];
  
    // Buscar o uso diário para o usuário atual
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let dailyUsage = await DailyUsage.findOne({ 
      userId: user._id, 
      date: today 
    });
  
    if (!dailyUsage) {
      dailyUsage = {
        spamMessages: 0,
        autoResponses: 0
      };
    }
  
    res.render('dashboard', { 
      user: user, 
      limits: userLimits, // Certifique-se de que está passando 'limits' e não 'userLimits'
      statusMessage: statusMessage,
      dailyUsage: dailyUsage
    });


  } catch (error) {
    console.error('Error in dashboard route:', error);
    res.status(500).render('error', { message: 'Um erro ocorreu ao carregar o dashboard' });
  }
};