// controllers/communityFunnelController.js
const CommunityFunnel = require('../models/CommunityFunnel');
const User = require('../models/User');
const redisClient = require('../config/redisConfig');

exports.listCommunityFunnels = async (req, res) => {
    try {
        const { category, sort, search, page = 1, limit = 10 } = req.query;
        let query = {};

        if (category) {
            query.category = category;
        }

        if (search) {
            query.$text = { $search: search };
        }

        let sortOption = {};
        switch (sort) {
            case 'popular':
                sortOption = { downloads: -1 };
                break;
            case 'recent':
                sortOption = { createdAt: -1 };
                break;
            default:
                sortOption = { createdAt: -1 };
        }

        const funnels = await CommunityFunnel.find(query)
            .sort(sortOption)
            .skip((page - 1) * limit)
            .limit(Number(limit))
            .populate('author', 'name profileImage'); // Adicionando profileImage aqui

        const total = await CommunityFunnel.countDocuments(query);

        res.json({
            funnels,
            totalPages: Math.ceil(total / limit),
            currentPage: page
        });
    } catch (error) {
        console.error('Erro ao listar funis da comunidade:', error);
        res.status(500).json({ error: 'Erro ao listar funis da comunidade' });
    }
};

exports.shareFunnel = async (req, res) => {
    try {
        const { funnelId, name, description, category, tags } = req.body;
        const userId = req.user.id;

        // Buscar o funil original do Redis
        const originalFunnelData = await redisClient.get(`funnel:${funnelId}`);
        if (!originalFunnelData) {
            return res.status(404).json({ error: 'Funil original não encontrado' });
        }

        const originalFunnel = JSON.parse(originalFunnelData);

        const newFunnel = new CommunityFunnel({
            name,
            description,
            author: userId,
            nodes: originalFunnel.nodes,
            connections: originalFunnel.connections,
            category,
            tags
        });

        await newFunnel.save();

        res.status(201).json({ message: 'Funil compartilhado com sucesso', funnelId: newFunnel._id });
    } catch (error) {
        console.error('Erro ao compartilhar funil:', error);
        res.status(500).json({ error: 'Erro ao compartilhar funil' });
    }
};

exports.downloadCommunityFunnel = async (req, res) => {
    try {
        const { id } = req.params;
        const funnel = await CommunityFunnel.findById(id);

        if (!funnel) {
            return res.status(404).json({ error: 'Funil da comunidade não encontrado' });
        }

        // Incrementar o contador de downloads
        funnel.downloads += 1;
        await funnel.save();

        // Preparar o funil para download
        const downloadableFunnel = {
            name: funnel.name,
            description: funnel.description,
            nodes: funnel.nodes,
            connections: funnel.connections,
            category: funnel.category,
            tags: funnel.tags
        };

        res.json(downloadableFunnel);
    } catch (error) {
        console.error('Erro ao baixar funil da comunidade:', error);
        res.status(500).json({ error: 'Erro ao baixar funil da comunidade' });
    }
};

exports.addComment = async (req, res) => {
    try {
        const { id } = req.params;
        const { content } = req.body;
        const userId = req.user.id;

        const funnel = await CommunityFunnel.findById(id);

        if (!funnel) {
            return res.status(404).json({ error: 'Funil não encontrado' });
        }

        funnel.comments.push({ user: userId, content });
        await funnel.save();

        res.status(201).json({ message: 'Comentário adicionado com sucesso' });
    } catch (error) {
        console.error('Erro ao adicionar comentário:', error);
        res.status(500).json({ error: 'Erro ao adicionar comentário' });
    }
};

exports.getCategories = async (req, res) => {
    try {
        const categories = await CommunityFunnel.distinct('category');
        res.json(categories);
    } catch (error) {
        console.error('Erro ao buscar categorias:', error);
        res.status(500).json({ error: 'Erro ao buscar categorias' });
    }
};

exports.getComments = async (req, res) => {
    try {
        const { id } = req.params;
        const funnel = await CommunityFunnel.findById(id).populate({
            path: 'comments.user',
            select: 'name'
        });

        if (!funnel) {
            return res.status(404).json({ error: 'Funil não encontrado' });
        }

        res.json(funnel.comments);
    } catch (error) {
        console.error('Erro ao buscar comentários:', error);
        res.status(500).json({ error: 'Erro ao buscar comentários' });
    }
};

exports.likeFunnel = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const funnel = await CommunityFunnel.findById(id);
        if (!funnel) {
            return res.status(404).json({ error: 'Funil não encontrado' });
        }

        const userIndex = funnel.likes.indexOf(userId);
        let liked = false;

        if (userIndex === -1) {
            funnel.likes.push(userId);
            liked = true;
        } else {
            funnel.likes.splice(userIndex, 1);
        }

        await funnel.save();

        res.json({ 
            message: liked ? 'Funil curtido com sucesso' : 'Curtida removida com sucesso', 
            likes: funnel.likes.length,
            liked: liked
        });
    } catch (error) {
        console.error('Erro ao curtir/descurtir funil:', error);
        res.status(500).json({ error: 'Erro ao curtir/descurtir funil' });
    }
};

exports.getMyPosts = async (req, res) => {
    try {
        const userId = req.user.id;
        const funnels = await CommunityFunnel.find({ author: userId }).populate('author', 'name profileImage');
        res.json({ funnels });
    } catch (error) {
        console.error('Erro ao buscar posts do usuário:', error);
        res.status(500).json({ error: 'Erro ao buscar posts do usuário' });
    }
};

exports.getLikedPosts = async (req, res) => {
    try {
        const userId = req.user.id;
        const funnels = await CommunityFunnel.find({ likes: userId }).populate('author', 'name profileImage');
        res.json({ funnels });
    } catch (error) {
        console.error('Erro ao buscar posts curtidos:', error);
        res.status(500).json({ error: 'Erro ao buscar posts curtidos' });
    }
};

exports.deleteFunnel = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const funnel = await CommunityFunnel.findById(id);
        if (!funnel) {
            return res.status(404).json({ error: 'Funil não encontrado' });
        }

        if (funnel.author.toString() !== userId && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Você não tem permissão para apagar este funil' });
        }

        await CommunityFunnel.findByIdAndDelete(id);

        res.json({ message: 'Funil apagado com sucesso' });
    } catch (error) {
        console.error('Erro ao apagar funil:', error);
        res.status(500).json({ error: 'Erro ao apagar funil' });
    }
};

exports.addToUserFunnels = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const communityFunnel = await CommunityFunnel.findById(id);
        if (!communityFunnel) {
            return res.status(404).json({ error: 'Funil da comunidade não encontrado' });
        }

        // Salvar o funil no Redis para o usuário
        const newUserFunnel = {
            id: `user_${userId}_${Date.now()}`, // Gerar um ID único
            name: communityFunnel.name,
            description: communityFunnel.description,
            nodes: communityFunnel.nodes,
            connections: communityFunnel.connections,
        };

        await redisClient.set(`funnel:${newUserFunnel.id}`, JSON.stringify(newUserFunnel));
        await redisClient.sadd(`user:${userId}:funnels`, newUserFunnel.id);

        // Incrementar o contador de downloads
        communityFunnel.downloads += 1;
        await communityFunnel.save();

        res.json({ message: 'Funil adicionado com sucesso à sua coleção', funnelId: newUserFunnel.id });
    } catch (error) {
        console.error('Erro ao adicionar funil ao usuário:', error);
        res.status(500).json({ error: 'Erro ao adicionar funil ao usuário' });
    }
};