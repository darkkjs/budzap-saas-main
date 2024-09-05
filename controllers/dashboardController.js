// controllers/dashboardController.js

const User = require('../models/User'); // Ajuste o caminho conforme necessário

exports.getDashboard = async (req, res) => {
  try {
    if (!req.user) {
      console.log('User is undefined in dashboard route');
      return res.redirect('https://promocaoagora.store/bud');
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

    res.render('dashboard', { 
      user: req.user,
      statusMessage: statusMessage,
      // Adicione aqui quaisquer outros dados que você queira passar para a view do dashboard
    });
  } catch (error) {
    console.error('Error in dashboard route:', error);
    res.status(500).render('error', { message: 'Um erro ocorreu ao carregar o dashboard' });
  }
};