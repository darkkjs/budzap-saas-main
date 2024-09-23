// controllers/communityFunnelController.js
const CommunityFunnel = require('../models/CommunityFunnel');
const User = require('../models/User');
const redisClient = require('../config/redisConfig');
const UserPurchase = require('../models/UserPurchase');

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
   // Contar o total de documentos que correspondem à query
   const total = await CommunityFunnel.countDocuments(query);

        const funnels = await CommunityFunnel.find(query)
            .sort(sortOption)
            .skip((page - 1) * limit)
            .limit(Number(limit))
            .populate('author', 'name profileImage');

        // Adicionar informação se o funil está liberado para o usuário
        const funnelsWithAccess = funnels.map(funnel => {
            const hasAccess = funnel.price === 0 || 
                              (req.user && req.user.purchasedFunnels && req.user.purchasedFunnels.includes(funnel._id));
            return {
                ...funnel.toObject(),
                hasAccess
            };
        });

        res.json({
            funnels: funnelsWithAccess,
            totalPages: Math.ceil(total / limit),
            currentPage: page
        });
    } catch (error) {
        console.error('Erro ao listar funis da comunidade:', error);
        res.status(500).json({ error: 'Erro ao listar funis da comunidade' });
    }
};


// Adicione esta nova função para iniciar o processo de compra
exports.initiatePurchase = async (req, res) => {
    try {
        const { funnelId } = req.params;
        const userId = req.user.id;

        const funnel = await CommunityFunnel.findById(funnelId);
        if (!funnel) {
            return res.status(404).json({ error: 'Funil não encontrado' });
        }

        const purchase = new UserPurchase({
            userId,
            funnelId,
            price: funnel.price,
            paymentStatus: 'pending'
        });

        await purchase.save();

        // Aqui você pode integrar com seu sistema de pagamento (por exemplo, gerar QR code PIX)
        // Por enquanto, vamos apenas simular a geração de um código de pagamento
        const paymentCode = `PAY-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

        res.json({
            message: 'Compra iniciada',
            purchaseId: purchase._id,
            paymentCode,
            price: funnel.price
        });
    } catch (error) {
        console.error('Erro ao iniciar compra:', error);
        res.status(500).json({ error: 'Erro ao iniciar compra' });
    }
};

exports.shareFunnel = async (req, res) => {
    try {
        const { funnelId, name, description, category, tags, price, requiredPlan } = req.body;
        const userId = req.user.id;


         // Verificar se o usuário é admin
         if (price && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Apenas administradores podem definir preço e plano requerido' });
        }

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
            tags,
            price: price || 0,
            requiredPlan: requiredPlan || null
        });

        await newFunnel.save();

        res.status(201).json({ message: 'Funil compartilhado com sucesso', funnelId: newFunnel._id });
    } catch (error) {
        console.error('Erro ao compartilhar funil:', error);
        res.status(500).json({ error: 'Erro ao compartilhar funil' });
    }
};


exports.generatePixPayment = async (req, res) => {
    try {
        const { id } = req.params;
        const funnel = await CommunityFunnel.findById(id);

        if (!funnel) {
            return res.status(404).json({ error: 'Funil não encontrado' });
        }

        const pixPaymentData = {
            reference_id: `funnel_${funnel._id}`,
            customer: {
                name: req.user.name,
                email: req.user.email,
                tax_id: req.user.taxId, // Certifique-se de ter esse campo no modelo de usuário
            },
            items: [
                {
                    name: funnel.name,
                    quantity: 1,
                    unit_amount: funnel.price * 100 // O valor deve ser em centavos
                }
            ],
            qr_codes: [
                {
                    amount: {
                        value: funnel.price * 100
                    },
                    expiration_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 horas de validade
                }
            ],
            notification_urls: [
                `${process.env.BASE_URL}/api/webhooks/pagbank-pix`
            ]
        };

        const response = await axios.post('https://sandbox.api.pagseguro.com/orders', pixPaymentData, {
            headers: {
                'Authorization': `Bearer ${process.env.PAGBANK_API_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        const qrCodeData = response.data.qr_codes[0];

        res.json({
            qrCodeImage: qrCodeData.links.find(link => link.media === 'image/png').href,
            pixCode: qrCodeData.text
        });
    } catch (error) {
        console.error('Erro ao gerar QR Code PIX:', error);
        res.status(500).json({ error: 'Erro ao gerar QR Code PIX' });
    }
};

exports.downloadCommunityFunnel = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const funnel = await CommunityFunnel.findById(id);

        if (!funnel) {
            return res.status(404).json({ error: 'Funil da comunidade não encontrado' });
        }

        // Verificar se o usuário tem o plano necessário
        if (funnel.requiredPlan && req.user.plan !== funnel.requiredPlan) {
            return res.status(403).json({ error: 'Você não tem o plano necessário para baixar este funil', requiresPurchase: true });
        }

        // Verificar se o funil é pago e se o usuário já comprou
        if (funnel.price > 0) {
            const hasPurchased = await UserPurchase.findOne({ userId, funnelId: id });
            if (!hasPurchased) {
                return res.status(402).json({ 
                    error: 'Pagamento necessário',
                    requiresPurchase: true,
                    funnelId: id,
                    price: funnel.price
                });
            }
        }

        // Se chegou aqui, o usuário pode baixar o funil
        funnel.downloads += 1;
        await funnel.save();

        const downloadableFunnel = {
            name: funnel.name,
            description: funnel.description,
            nodes: funnel.nodes,
            connections: funnel.connections,
            category: funnel.category,
            tags: funnel.tags
        };

        res.json({ funnel: downloadableFunnel, message: 'Download autorizado' });
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


exports.checkPaymentStatus = async (req, res) => {
    try {
        const { paymentId } = req.params;
        const payment = await PendingPayment.findById(paymentId);

        if (!payment) {
            return res.status(404).json({ error: 'Pagamento não encontrado' });
        }

        // Aqui você integraria com a API da PagSeguro para verificar o status do pagamento
        // Por enquanto, vamos simular uma verificação aleatória
        const isPaid = Math.random() < 0.5;

        if (isPaid) {
            payment.status = 'paid';
            await payment.save();

            // Permitir o download do funil
            const funnel = await CommunityFunnel.findById(payment.funnelId);
            funnel.downloads += 1;
            await funnel.save();

            const downloadableFunnel = {
                name: funnel.name,
                description: funnel.description,
                nodes: funnel.nodes,
                connections: funnel.connections,
                category: funnel.category,
                tags: funnel.tags
            };

            return res.json({ status: 'paid', funnel: downloadableFunnel });
        }

        res.json({ status: payment.status });
    } catch (error) {
        console.error('Erro ao verificar status do pagamento:', error);
        res.status(500).json({ error: 'Erro ao verificar status do pagamento' });
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