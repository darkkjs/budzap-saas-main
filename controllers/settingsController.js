const User = require('../models/User');

exports.getSettings = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        res.render('settings', { user });
    } catch (error) {
        console.error('Erro ao buscar configurações:', error);
        res.status(500).render('error', { message: 'Erro ao carregar configurações' });
    }
};

exports.updateSettings = async (req, res) => {
    try {
        const { name, email, notificationPreferences } = req.body;
        const user = await User.findByIdAndUpdate(req.user.id, {
            name,
            email,
            notificationPreferences
        }, { new: true });

        req.flash('success_msg', 'Configurações atualizadas com sucesso');
        res.redirect('/settings');
    } catch (error) {
        console.error('Erro ao atualizar configurações:', error);
        req.flash('error_msg', 'Erro ao atualizar configurações');
        res.redirect('/settings');
    }
};