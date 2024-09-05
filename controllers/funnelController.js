// controllers/funnelController.js
const User = require('../models/User');

const PLAN_LIMITS = {
    gratuito: 1,
    basico: 2,
    plus: 25,
    premium: Infinity
};

exports.listFunnels = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
       // console.log('User:', user);
        //console.log('Funnels:', user.funnels);
        res.json(user.funnels);
    } catch (error) {
        console.error('Erro ao listar funis:', error);
        res.status(500).json({ message: 'Erro ao listar funis', error: error.message });
    }
};

exports.createFunnel = async (req, res) => {
    try {
        const { name, description, steps } = req.body;
        const user = await User.findById(req.user.id);

       // Verificar o limite do plano
if (user.plan !== 'premium' && user.funnels.length >= PLAN_LIMITS[user.plan]) {
    return res.status(403).json({
        message: 'Limite de funis atingido para o seu plano',
        currentPlan: user.plan,
        limit: PLAN_LIMITS[user.plan]
    });
}

// Código para continuar caso o limite não tenha sido atingido

        const newFunnel = {
            name,
            description,
            steps,
            createdAt: new Date()
        };

        user.funnels.push(newFunnel);
        await user.save();

        res.status(201).json(newFunnel);
    } catch (error) {
        console.error('Erro ao criar funil:', error);
        res.status(500).json({ message: 'Erro ao criar funil', error: error.message });
    }
};

exports.updateFunnel = async (req, res) => {
    try {
        const { id } = req.params;
        const updatedFunnel = req.body;
        
        const user = await User.findById(req.user.id);
        const funnelIndex = user.funnels.findIndex(f => f._id.toString() === id);
        
        if (funnelIndex === -1) {
            return res.status(404).json({ error: 'Funil não encontrado' });
        }
        
        user.funnels[funnelIndex] = updatedFunnel;
        await user.save();
        
        res.json({ success: true, message: 'Funil atualizado com sucesso' });
    } catch (error) {
        console.error('Erro ao atualizar funil:', error);
        res.status(500).json({ error: 'Erro ao atualizar funil' });
    }
};

exports.getFunnelById = async (funnelId, userId) => {
    try {
        const user = await User.findById(userId);
        return user.funnels.id(funnelId);
    } catch (error) {
        console.error('Erro ao buscar funil:', error);
        throw error;
    }
};

exports.deleteFunnel = async (req, res) => {
    try {
        const { id } = req.params;
        const user = await User.findById(req.user.id);
        
        // Encontrar o índice do funil no array de funis do usuário
        const funnelIndex = user.funnels.findIndex(funnel => funnel._id.toString() === id);
        
        if (funnelIndex === -1) {
            return res.status(404).json({ error: 'Funil não encontrado' });
        }
        
        // Remover o funil do array
        user.funnels.splice(funnelIndex, 1);
        
        // Salvar as alterações no usuário
        await user.save();
        
        res.json({ message: 'Funil deletado com sucesso' });
    } catch (error) {
        console.error('Erro ao deletar funil:', error);
        res.status(500).json({ error: 'Erro ao deletar funil' });
    }
};