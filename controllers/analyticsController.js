const User = require('../models/User');

exports.getAnalytics = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).populate('whatsappInstances');
        
        // Calcular estatísticas
        const totalMessages = user.funnelUsage;
        const totalAutoreplies = user.autoResponseCount;
        const totalFunnels = user.funnels.length;
        const totalGroups = user.whatsappInstances.reduce((acc, instance) => 
            acc + instance.chats.filter(chat => chat.isGroup).length, 0);

        // Calcular taxas de engajamento (exemplo simplificado)
        const engagementRate = (totalAutoreplies / totalMessages * 100).toFixed(2);

        // Dados para o gráfico de mensagens por dia (exemplo)
        const messagesToday = Math.floor(Math.random() * 100); // Substitua por dados reais
        const messagesYesterday = Math.floor(Math.random() * 100);
        const messagesTwoDaysAgo = Math.floor(Math.random() * 100);

        res.render('analytics', {
            user,
            totalMessages,
            totalAutoreplies,
            totalFunnels,
            totalGroups,
            engagementRate,
            messagesToday,
            messagesYesterday,
            messagesTwoDaysAgo
        });
    } catch (error) {
        console.error('Erro ao buscar análises:', error);
        res.status(500).render('error', { message: 'Erro ao carregar análises' });
    }
};