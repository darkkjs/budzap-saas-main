const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const User = require('../models/User');
const { ensureAuthenticated } = require('../middleware/auth');
const { PLAN_LIMITS, AUTO_RESPONSE_LIMITS } = require('../config/planLimits');
const stripeHelpers = require('../Helpers/stripeHelpers');
const {avisar} = require('../Helpers/avisos')

router.get('/subscription-success', async (req, res) => {
    const { id, userId } = req.query;

    try {
        // Recupera a sessão do Stripe
        const session = await stripe.checkout.sessions.retrieve(id);
        console.log(session);
        console.log(session.payment_status);

        // Verifica se a sessão foi bem-sucedida
        if (session.payment_status === 'paid') {
          
            const subscriptionId = session.subscription;

            // Recupera os detalhes da assinatura
            const subscription = await stripe.subscriptions.retrieve(subscriptionId);

            const user = await User.findById(userId);
            if (!user) {
                return res.status(404).json({ success: false, message: 'Usuário não encontrado' });
            }

            const plano = await stripeHelpers.getPlanFromPriceId(subscription.items.data[0].price.id);
            console.log(subscription.items.data[0].price);

            // Se o pagamento foi aprovado, atualize o plano do usuário
            const newFunnelLimit = PLAN_LIMITS[plano];
            const newAutoResponseLimit = AUTO_RESPONSE_LIMITS[plano];
            const validUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 dias a partir de agora

            const updatedUser = await User.findByIdAndUpdate(
                userId,
                {
                    $set: {
                        stripeCustomerId: session.customer,
                        stripeSubscriptionId: subscriptionId,
                        plan: plano,
                        validUntil: validUntil,
                        funnelLimit: newFunnelLimit,
                        autoResponseLimit: newAutoResponseLimit,
                        autoResponseCount: 0 // Resetamos o contador ao mudar de plano
                    },
                    $push: {
                        notifications: {
                            title: `Plano ${plano} assinado ✅`,
                            content: 'Bora aumentar suas vendas!',
                            timestamp: new Date()
                        }
                    }
                },
                { new: true, runValidators: true }
            );

            await avisar(req.user.phone, `🎉 Parabéns! Seu plano foi ativado com sucesso! 🚀

Agora você tem acesso a todos os recursos do plano ${plano}. Aproveite!

Se precisar de ajuda chame no número: 51995746157`)

// Função para formatar valores em reais
function formatarValorEmReais(valorEmCentavos) {
    // Converte de centavos para reais
    const valorEmReais = valorEmCentavos / 100;
  
    // Formata para o padrão de moeda brasileira
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valorEmReais);
  }

  const valorFormatado = formatarValorEmReais(subscription.items.data[0].price.unit_amount);


await avisar(process.env.numerodono, `🎉 *Nova venda realizada!*

💰 *Valor recebido:* ${valorFormatado}
📜 *Plano:* ${plano}

👤 *Usuário:* ${req.user.username}
📞 *Número:* ${req.user.phone}

🎊 Parabéns pela venda!`)

            if (!updatedUser) {
                throw new Error('Falha ao atualizar o usuário');
            }

            // Renderiza a página de sucesso
            return res.render('plano-sucess', { 
                layout: false, 
                plan: plano,
                validUntil: validUntil.toLocaleDateString(),
                funnelLimit: newFunnelLimit,
                autoResponseLimit: newAutoResponseLimit
            });
        } else {
            // Se o pagamento não foi bem-sucedido, redireciona para o dashboard com status de erro
            return res.redirect('/dashboard?status=error');
        }
    } catch (error) {
        console.error('Error processing successful subscription:', error);
        return res.redirect('/dashboard?status=error');
    }
});




router.post('/change-plan', ensureAuthenticated, async (req, res) => {
    const { newPlan, stripeToken } = req.body;

    const user = await User.findById(req.user.id);

    try {
        let customer;
        if (!user.stripeCustomerId) {
            customer = await stripe.customers.create({
                email: user.email,
                source: stripeToken
            });
            user.stripeCustomerId = customer.id;
        } else {
            customer = await stripe.customers.retrieve(user.stripeCustomerId);
        }
       
        const plans = {
            basico: 'price_1PkajCJd0dkXl3iIIigFzsTG',
            plus: 'price_1PlKbWJd0dkXl3iI1IsAG9FR',
            premium: 'price_1PlLFaJd0dkXl3iI4dVGf4Uw'
        };

        if (user.stripeSubscriptionId) {
            await stripe.subscriptions.del(user.stripeSubscriptionId);
        }

        const subscription = await stripe.subscriptions.create({
            customer: customer.id,
            items: [{ price: plans[newPlan] }],
        });

        user.stripeSubscriptionId = subscription.id;
        user.plan = newPlan;
        user.validUntil = new Date(subscription.current_period_end * 1000);

        // Update user limits based on the new plan
        if (newPlan === 'basico') {
            user.funnelLimit = 2;
            user.autoResponseLimit = 500;
        } else if (newPlan === 'plus') {
            user.funnelLimit = 25;
            user.autoResponseLimit = 1000;
        } else if (newPlan === 'premium') {
            user.funnelLimit = Infinity;
            user.autoResponseLimit = Infinity;
        }

        await user.save();

        req.flash('success_msg', 'Plano atualizado com sucesso!');
        res.redirect('/dashboard');
    } catch (error) {
        console.error('Erro ao atualizar o plano:', error);
        req.flash('error_msg', 'Ocorreu um erro ao atualizar o plano. Por favor, tente novamente.');
        res.redirect('/change-plan');
    }
});

module.exports = router;