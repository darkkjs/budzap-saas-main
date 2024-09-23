const Order = require('../models/Order');
const User = require('../models/User');
const { PLAN_LIMITS, AUTO_RESPONSE_LIMITS } = require('../config/planLimits');

const UserPurchasedFunnels = require('../models/UserPurchasedFunnels');
const CommunityFunnel = require('../models/CommunityFunnel');

exports.handlePagBankPixWebhook = async (req, res) => {
    try {
        const { reference_id, status } = req.body;

        if (status === 'PAID') {
            const funnelId = reference_id.split('_')[1];
            const funnel = await CommunityFunnel.findById(funnelId);

            if (funnel) {
                await UserPurchasedFunnels.create({
                    user: req.user._id,
                    funnel: funnelId
                });

                // Atualizar o usuário com o novo funil comprado
                await User.findByIdAndUpdate(req.user._id, {
                    $addToSet: { purchasedFunnels: funnelId }
                });
            }
        }

        res.sendStatus(200);
    } catch (error) {
        console.error('Erro ao processar webhook do PagBank:', error);
        res.sendStatus(500);
    }
};

exports.handleWebhook = async (req, res) => {
  const { id, charges } = req.body;

  try {
    const order = await Order.findOne({ orderId: id });
    if (!order) {
      console.log(`Pedido não encontrado: ${id}`);
      return res.status(404).send('Pedido não encontrado');
    }

    const paymentStatus = charges[0].status;
    order.status = paymentStatus;
    await order.save();

    if (paymentStatus === 'PAID') {
      const user = await User.findById(order.userId);
      if (user) {
        user.plan = order.plan;
        user.validUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        user.funnelLimit = PLAN_LIMITS[order.plan];
        user.autoResponseLimit = AUTO_RESPONSE_LIMITS[order.plan];
        await user.save();
        console.log(`Plano do usuário ${user._id} atualizado para ${order.plan}`);
      }
    }

    res.status(200).send('Webhook processado com sucesso');
  } catch (error) {
    console.error('Erro ao processar webhook:', error);
    res.status(500).send('Erro ao processar webhook');
  }
};
