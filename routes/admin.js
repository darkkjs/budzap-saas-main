const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { ensureAdmin } = require('../middleware/auth');
const bcrypt = require('bcryptjs');
const ValidationKey = require('../models/ValidationKey');
const { Parser } = require('json2csv');
const { PLAN_LIMITS, AUTO_RESPONSE_LIMITS } = require('../config/planLimits');
const { avisar } = require("../Helpers/avisos");

// Adicione estas rotas ao seu arquivo de rotas admin (provavelmente admin.js)

// Rota para obter usuários com planos próximos do vencimento
router.get('/expiring-plans', ensureAdmin, async (req, res) => {
    try {
        const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        const users = await User.find({
            $or: [
                { manualPlanActive: true, validUntil: { $lte: thirtyDaysFromNow, $gte: new Date() } },
                { stripeSubscriptionId: { $exists: true, $ne: null }, validUntil: { $lte: thirtyDaysFromNow, $gte: new Date() } }
            ]
        }).sort({ validUntil: 1 });

        const expiringPlans = users.map(user => ({
            id: user._id,
            name: user.name,
            plan: user.plan,
            validUntil: user.validUntil,
            daysRemaining: Math.ceil((user.validUntil - new Date()) / (1000 * 60 * 60 * 24)),
            phone: user.phone
        }));

        res.json(expiringPlans);
    } catch (error) {
        console.error('Erro ao obter planos próximos do vencimento:', error);
        res.status(500).json({ error: 'Erro ao obter planos próximos do vencimento' });
    }
});

// Rota para enviar lembrete
router.post('/send-reminder', ensureAdmin, async (req, res) => {
    try {
        const { userId } = req.body;
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }

        const message = `Olá ${user.name}! 👋

Esperamos que esteja aproveitando ao máximo seu plano ${user.plan} do BudZap. 🚀

Gostaríamos de lembrá-lo que seu plano atual expirará em ${user.daysRemaining} dias. Para continuar aproveitando todos os benefícios e recursos exclusivos, não se esqueça de renovar sua assinatura.

Ao renovar agora, você garante:
✅ Continuidade dos seus projetos
✅ Acesso ininterrupto às nossas ferramentas avançadas
✅ Suporte prioritário da nossa equipe

Para renovar, é fácil! Basta acessar sua conta em https://budzap.online e clicar em "Renovar Plano".

Tem alguma dúvida ou precisa de ajuda? Estamos aqui para você! Responda esta mensagem ou entre em contato pelo nosso suporte.

Obrigado por fazer parte da família BudZap! 🎉

Atenciosamente,
Equipe BudZap`;
console.log(user.phone, message)
        await avisar(user.phone, message);
        res.json({ success: true, message: 'Lembrete enviado com sucesso' });
    } catch (error) {
        console.error('Erro ao enviar lembrete:', error);
        res.status(500).json({ error: 'Erro ao enviar lembrete' });
    }
});

router.get('/login', (req, res) => {
    res.render('admin-login', { user: req.user });
});

router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await User.findOne({ username, role: 'admin' });
        if (user && await user.isValidPassword(password)) {
            req.session.isAdmin = true;
            res.redirect('/admin');
        } else {
            res.render('admin-login', { error: 'Credenciais inválidas' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).render('admin-login', { error: 'Erro no servidor' });
    }
});

router.get('/', ensureAdmin, async (req, res) => {
    try {
        const users = await User.find({});
        res.render('admin', { users, user: req.user });
    } catch (error) {
        res.status(500).send('Erro ao carregar usuários');
    }
});

router.post('/create-user', ensureAdmin, async (req, res) => {
    try {
        const { name, phone, email, username, password, role, plan, validUntil } = req.body;
        const user = new User({
            name,
            phone,
            email,
            username,
            password,
            role,
            plan,
            validUntil: new Date(validUntil)
        });
        await user.save();
        res.redirect('/admin');
    } catch (error) {
        res.status(500).send('Erro ao criar usuário');
    }
});

router.put('/user/:id', ensureAdmin, async (req, res) => {
  try {
    const { name, email, phone, username, role, plan, validUntil } = req.body;
    
    const updateData = {
      name,
      email,
      phone,
      username,
      role,
      plan,
      manualPlanActive: true,
      validUntil: new Date(validUntil),
      funnelLimit: PLAN_LIMITS[plan],
      autoResponseLimit: AUTO_RESPONSE_LIMITS[plan]
    };

    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ success: false, message: 'Usuário não encontrado' });
    }

    res.json({ success: true, user: updatedUser });
  } catch (error) {
    console.error('Erro ao atualizar usuário:', error);
    res.status(500).json({ success: false, message: 'Erro ao atualizar usuário', error: error.message });
  }
});

router.delete('/user/:id', ensureAdmin, async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Usuário não encontrado' });
    }
    res.json({ success: true, message: 'Usuário deletado com sucesso' });
  } catch (error) {
    console.error('Erro ao deletar usuário:', error);
    res.status(500).json({ success: false, message: 'Erro ao deletar usuário' });
  }
})


router.get('/user/:id', ensureAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Usuário não encontrado' });
    }
    res.json(user);
  } catch (error) {
    console.error('Erro ao buscar usuário:', error);
    res.status(500).json({ success: false, message: 'Erro ao buscar usuário' });
  }
});

router.get('/create-validation-key', ensureAdmin, async (req, res) => {
    try {
        const { plan } = req.query;

        if (!plan) {
            return res.status(400).json({ success: false, message: 'O plano é obrigatório' });
        }

        if (!['basico', 'plus', 'premium'].includes(plan)) {
            return res.status(400).json({ success: false, message: 'Plano inválido. Deve ser "basico", "plus" ou "premium"' });
        }

        const key = await generateUniqueKey();
        const newValidationKey = new ValidationKey({
            key: key,
            plan: plan
        });

        await newValidationKey.save();

        res.json({ success: true, key, plan });
    } catch (error) {
        console.error('Erro ao criar chave de validação:', error);
        res.status(500).json({ success: false, message: 'Erro ao criar chave de validação' });
    }
});

router.get('/validation-keys', ensureAdmin, async (req, res) => {
    try {
        const keys = await ValidationKey.find().lean();
        res.json(keys);
    } catch (error) {
        console.error('Erro ao listar chaves de validação:', error);
        res.status(500).json({ message: 'Erro ao listar chaves de validação' });
    }
});

router.get('/export-users', ensureAdmin, async (req, res) => {
  try {
    const users = await User.find({}).lean();

    const fields = [
      { label: 'Nome', value: 'name' },
      { label: 'Email', value: 'email' },
      { label: 'Telefone', value: 'phone' },
      { label: 'Username', value: 'username' },
      { label: 'Cargo', value: 'role' },
      { label: 'Plano', value: 'plan' },
      { label: 'Plano Manual Ativo', value: 'manualPlanActive' },
      { label: 'Validade do Plano Manual', value: row => row.validUntil ? new Date(row.validUntil).toLocaleDateString() : 'N/A' },
      { label: 'Limite de Funis', value: 'funnelLimit' },
      { label: 'Limite de Auto Respostas', value: 'autoResponseLimit' }
    ];

    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(users);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=usuarios_budzap.csv');
    res.status(200).send(csv);

  } catch (error) {
    console.error('Erro ao exportar usuários:', error);
    res.status(500).json({ success: false, message: 'Erro ao exportar usuários', error: error.message });
  }
});

function generateUniqueKey() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}


router.get('/dashboard-data', ensureAdmin, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const now = new Date();

    const activeUsers = await User.aggregate([
      {
        $match: {
          $or: [
            { manualPlanActive: true, validUntil: { $gt: now } },
            { stripeSubscriptionId: { $exists: true, $ne: null } }
          ]
        }
      },
      {
        $group: {
          _id: '$plan',
          count: { $sum: 1 }
        }
      }
    ]);

    const planPrices = {
      basico: 25,
      plus: 45,
      premium: 65
    };

    let monthlyRevenue = 0;
    const usersByPlanObject = {};

    activeUsers.forEach(plan => {
      usersByPlanObject[plan._id] = plan.count;
      monthlyRevenue += plan.count * (planPrices[plan._id] || 0);
    });

    res.json({
      totalUsers,
      usersByPlan: usersByPlanObject,
      monthlyRevenue
    });
  } catch (error) {
    console.error('Erro ao obter dados do dashboard:', error);
    res.status(500).json({ error: 'Erro ao obter dados do dashboard' });
  }
});

router.get('/users', ensureAdmin, async (req, res) => {
  try {
      const users = await User.find({}).select('-password');
      res.json(users);
  } catch (error) {
      console.error('Erro ao obter usuários:', error);
      res.status(500).json({ error: 'Erro ao obter usuários' });
  }
});


module.exports = router;