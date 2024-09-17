// analyticsController.js
const User = require('../models/User');
const DailyUsage = require('../models/DailyUsage');
const PLAN_LIMITS = require('../config/planLimits');

exports.getAnalytics = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).populate('whatsappInstances');
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // Buscar uso diário dos últimos 7 dias
        const last7Days = Array.from({length: 7}, (_, i) => {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            return d;
        });

        const dailyUsages = await DailyUsage.find({
            userId: user._id,
            date: { $gte: last7Days[6], $lte: last7Days[0] }
        }).sort({ date: 1 });

        // Calcular estatísticas
        const totalMessages = dailyUsages.reduce((sum, usage) => sum + usage.spamMessages, 0);
        const totalAutoreplies = dailyUsages.reduce((sum, usage) => sum + usage.autoResponses, 0);
        const totalFunnels = user.funnels.length;
        const totalGroups = user.whatsappInstances.reduce((acc, instance) => 
            acc + (instance.chats ? instance.chats.filter(chat => chat.isGroup).length : 0), 0);

        // Calcular taxas de engajamento
        const engagementRate = totalMessages > 0 ? ((totalAutoreplies / totalMessages) * 100).toFixed(2) : 0;

        // Preparar dados para gráficos
        const dates = last7Days.map(d => d.toISOString().split('T')[0]).reverse();
        const spamData = dates.map(date => {
            const usage = dailyUsages.find(u => u.date.toISOString().split('T')[0] === date);
            return usage ? usage.spamMessages : 0;
        });
        const autoResponseData = dates.map(date => {
            const usage = dailyUsages.find(u => u.date.toISOString().split('T')[0] === date);
            return usage ? usage.autoResponses : 0;
        });

        // Calcular uso em relação aos limites
        const limits = PLAN_LIMITS[user.plan];
        const usagePercentages = {
            whatsappConnections: (user.whatsappInstances.length / limits.whatsappConnections) * 100,
            funnels: (totalFunnels / limits.funnels) * 100,
            dailySpamMessages: (dailyUsages[0]?.spamMessages / limits.dailySpamMessages) * 100,
            dailyAutoResponses: (dailyUsages[0]?.autoResponses / limits.dailyAutoResponses) * 100
        };

        res.render('analytics', {
            user,
            totalMessages,
            totalAutoreplies,
            totalFunnels,
            totalGroups,
            engagementRate,
            dates,
            spamData,
            autoResponseData,
            usagePercentages,
            limits
        });
    } catch (error) {
        console.error('Erro ao buscar análises:', error);
        res.status(500).render('error', { message: 'Erro ao carregar análises' });
    }
};