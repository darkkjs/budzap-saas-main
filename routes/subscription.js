const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const User = require('../models/User');
const { ensureAuthenticated } = require('../middleware/auth');

const stripeHelpers = require('../Helpers/stripeHelpers');




const DailyUsage = require('../models/DailyUsage');
const  PLAN_LIMITS = require('../config/planLimits');
const { avisar } = require("../Helpers/avisos");

router.get('/subscription-success', async (req, res) => {
    const { id, userId } = req.query;

    try {
        const session = await stripe.checkout.sessions.retrieve(id);
        console.log(session);
        console.log(session.payment_status);
        
        if (session.payment_status === 'paid') {
            const subscriptionId = session.subscription;

            // Recupera os detalhes da assinatura
            const subscription = await stripe.subscriptions.retrieve(subscriptionId);

            const user = await User.findById(userId);
            if (!user) {
                return res.status(404).json({ success: false, message: 'Usuário não encontrado' });
            }

            const plano = await stripeHelpers.getPlanFromPriceId(subscription.items.data[0].price.id);
            console.log("Plano detectado:", plano);

            // Verifica se o plano existe no PLAN_LIMITS
            if (!PLAN_LIMITS[plano]) {
                console.error(`Plano não reconhecido: ${plano}`);
                return res.status(400).json({ success: false, message: 'Plano não reconhecido' });
            }

            // Se o pagamento foi aprovado, atualize o plano do usuário
            const newFunnelLimit = PLAN_LIMITS[plano].funnels;
            const validUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 dias a partir de agora

            const updatedUser = await User.findByIdAndUpdate(
                userId,
                {
                    $set: {
                        stripeCustomerId: session.customer,
                        stripeSubscriptionId: subscriptionId,
                        plan: plano,
                        validUntil: validUntil,
                        funnelLimit: newFunnelLimit
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
            
            // Resetar o uso diário para o novo plano
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            await DailyUsage.findOneAndUpdate(
                { userId: userId, date: today },
                { 
                    $set: {
                        spamMessages: 0,
                        autoResponses: 0
                    }
                },
                { upsert: true, new: true }
            );

            await avisar(user.phone, `🎉 Parabéns! Seu plano foi ativado com sucesso! 🚀

Agora você tem acesso a todos os recursos do plano ${plano}. Aproveite!

Se precisar de ajuda chame no número: 51995746157`);

            function formatarValorEmReais(valorEmCentavos) {
                const valorEmReais = valorEmCentavos / 100;
                return new Intl.NumberFormat('pt-BR', {
                    style: 'currency',
                    currency: 'BRL'
                }).format(valorEmReais);
            }

            const valorFormatado = formatarValorEmReais(subscription.items.data[0].price.unit_amount);

            await avisar(process.env.numerodono, `🎉 *Nova venda realizada!*

💰 *Valor recebido:* ${valorFormatado}
📜 *Plano:* ${plano}

👤 *Usuário:* ${user.username}
📞 *Número:* ${user.phone}

🎊 Parabéns pela venda!`);

            if (!updatedUser) {
                throw new Error('Falha ao atualizar o usuário');
            }

            // Renderiza a página de sucesso
            return res.render('plano-sucess', { 
                layout: false, 
                plan: plano,
                validUntil: validUntil.toLocaleDateString(),
                funnelLimit: newFunnelLimit
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

        if (user.stripeSubscriptionIde) {
            await stripe.subscriptions.del(user.stripeSubscriptionIde);
        }

        const subscription = await stripe.subscriptions.create({
            customer: customer.id,
            items: [{ price: plans[newPlan] }],
        });

        user.stripeSubscriptionIde = subscription.id;
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