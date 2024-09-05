const User = require('../models/User');

exports.getNotifications = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('notifications');
        res.render('notifications', { notifications: user.notifications, user: req.user });
    } catch (error) {
        console.error('Erro ao buscar notificações:', error);
        res.status(500).render('error', { message: 'Erro ao carregar notificações' });
    }
};

exports.markAsRead = async (req, res) => {
    try {
        const { notificationId } = req.body;
        await User.findOneAndUpdate(
            { _id: req.user.id, "notifications._id": notificationId },
            { $set: { "notifications.$.read": true } }
        );
        res.json({ success: true });
    } catch (error) {
        console.error('Erro ao marcar notificação como lida:', error);
        res.status(500).json({ success: false, message: 'Erro ao atualizar notificação' });
    }
};

exports.deleteNotification = async (req, res) => {
    try {
        const { notificationId } = req.body;
        await User.findByIdAndUpdate(req.user.id, {
            $pull: { notifications: { _id: notificationId } }
        });
        res.json({ success: true });
    } catch (error) {
        console.error('Erro ao deletar notificação:', error);
        res.status(500).json({ success: false, message: 'Erro ao deletar notificação' });
    }
};