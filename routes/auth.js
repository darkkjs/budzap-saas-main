const express = require('express');
const passport = require('passport');
const router = express.Router();
const { stripe } = require('../stripe');
const User = require('../models/User');
const { PLANS } = require('../stripe');
const  PLAN_LIMITS  = require('../config/planLimits');
const { ensureAuthenticated } = require('../middleware/auth');
const { MercadoPagoConfig, Preference } = require('mercadopago');
const axios = require("axios")
// Configure o cliente do Mercado Pago
const client = new MercadoPagoConfig({ accessToken: 'APP_USR-656903818257059-081810-20fede545aba678a7e41cf0a6edf3475-1929652882' });
const ValidationKey = require('../models/ValidationKey');
const bcrypt = require('bcryptjs');
const admtokenapi = "dark_adm"
const dashboardController = require('../controllers/dashboardController');
const {avisar} = require("../Helpers/avisos")
router.get('/', ensureAuthenticated, dashboardController.getDashboard);


const schedule = require('node-schedule');

function scheduleReminders(user) {
  if (!user || !user.createdAt || !user.name || !user.phone) {
    console.error('Dados de usuário inválidos para agendar lembretes');
    return;
  }

  const reminderTimes = [1, 3, 7, 14, 30, 60]; // dias após o registro
  const now = new Date();
  
  reminderTimes.forEach(days => {
    const reminderDate = new Date(user.createdAt.getTime() + days * 24 * 60 * 60 * 1000);
    
    // Só agenda lembretes para datas futuras
    if (reminderDate > now) {
      schedule.scheduleJob(reminderDate, async function() {
        try {
          const updatedUser = await User.findById(user._id);
          if (updatedUser && updatedUser.plan === 'gratuito') {
            const message = `Olá ${updatedUser.name}! Já se passaram ${days} dias desde que você se registrou no HocketZap. Que tal experimentar nossos planos premium e aproveitar todos os recursos?`;
            await sendTextMessage(updatedUser.phone, message);
            console.log(`Lembrete enviado para ${updatedUser.name} após ${days} dias`);
          }
        } catch (error) {
          console.error(`Erro ao enviar lembrete para o usuário ${user._id} após ${days} dias:`, error);
        }
      });
    }
  });
}


/*/
router.get('/', ensureAuthenticated, async (req, res) => {
  try {
    if (!req.user) {
      console.log('User is undefined in dashboard route');
      return res.redirect('https://app.hocketzap.com');
    }
    console.log('Rendering dashboard for user:', req.user.username);
    res.render('dashboard', { user: req.user });
  } catch (error) {
    console.error('Error in dashboard route:', error);
    res.status(500).render('error', { message: 'Um erro ocorreu ao carregar o dashboard' });
  }
});/*/

const now = new Date();


router.get('/faq', ensureAuthenticated, async (req, res) => {

  
    res.render('faq', { layout: false });
 
});

router.get('/check', ensureAuthenticated, async (req, res) => {

  const id = req.query.id;

  res.render('checkout', { layout: false, id: id });

});

router.get('/change-plan', ensureAuthenticated, async (req, res) => {
  const userId = req.user.id;
  
  console.log(userId)
  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).render('error', { message: 'Usuário não encontrado' });
    }

    res.render('change-plan', {
        title: 'Planos',
        currentPlan: user.plan,
        plans: PLANS,
        userId: user._id,
        atualplan: user.plan,
        user: req.user
    });
  } catch (error) {
    console.log(error)
  //  res.status(500).render('error', { message: error.message });
  }
});


const priceIds2 = {
  plus: 'price_1PlKbWJd0dkXl3iI1IsAG9FR', // Substitua com o ID real do preço
  premium: 'price_1PlLFaJd0dkXl3iI4dVGf4Uw' // Substitua com o ID real do preço
};

/*/
router.post('/create-checkout-session', async (req, res) => {
  const { plan, userId } = req.body;

  const priceId = priceIds2[plan];

  if (!priceId) {
    return res.status(400).json({ error: 'Invalid plan selected' });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1
        }
      ],
      mode: 'subscription',
      success_url: `https://hocketzap.com/update-user-plan?userId=${userId}&plan=${plan}`,
      cancel_url: `https://hocketzap.com/dashboard`
    });

    res.json({ id: session.id });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});/*/

router.post('/create-checkout-session', async (req, res) => {
  const { plan, userId } = req.body;

  const prices = {
    basico: 25.00,
    plus: 45.00,
    premium: 65.00
  };

  const price = prices[plan];

  if (!price) {
    return res.status(400).json({ error: 'Plano inválido' });
  }

  try {
    const preference = new Preference(client);
    const result = await preference.create({
      body: {
        items: [
          {
            title: `Plano ${plan} HocketZap`,
            unit_price: price,
            quantity: 1,
            currency_id: 'BRL',
            description: `Assinatura mensal do plano ${plan} do HocketZap - Automatize seu WhatsApp`,
            picture_url: 'https://hotboard.online/wp-content/uploads/2024/05/348ca653-6a73-424b-85a2-3e6db393826a-768x768.jpeg', // Substitua pelo URL real do seu logo
          }
        ],
        payer: {
          name: req.user.name,
          email: req.user.email,
          phone: {
            area_code: req.user.phone.substring(0, 2),
            number: req.user.phone.substring(2)
          }
        },
        payment_methods: {
          excluded_payment_types: [
            { id: "ticket" }
          ],
          installments: 1
        },
        back_urls: {
          success: `https://hocketzap.com/update-user-plan?userId=${userId}&plan=${plan}`,
          failure: `https://hocketzap.com/dashboard`,
          pending: `https://hocketzap.com/update-user-plan?userId=${userId}&plan=${plan}`
        },
        auto_return: 'approved',
        external_reference: userId,
        statement_descriptor: 'BUDZAP',
        expires: true,
        expiration_date_to: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Expira em 24 horas
      },
      // Configurações extras para melhorar a aparência
      binary_mode: true, // Aceita apenas pagamentos aprovados ou rejeitados

    });

    res.json({ id: result.id });
  } catch (error) {
    console.error('Erro ao criar preferência de pagamento:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.get('/payment-pending', (req, res) => {
  res.render('payment-pending', {
    layout: false,
    message: 'Seu pagamento está pendente. Por favor, verifique o status do seu pagamento no Mercado Pago.'
  });
});

const { Payment } = require('mercadopago');

const DailyUsage = require('../models/DailyUsage');
router.get('/update-user-plan', async (req, res) => {
  const { 
    userId, 
    plan, 
    collection_status, 
    payment_id, 
    status,
    preference_id 
  } = req.query;

  if (!userId || !plan || !payment_id || !preference_id) {
    return res.status(400).json({ success: false, message: 'Parâmetros inválidos' });
  }

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Usuário não encontrado' });
    }

    // Verificar o status do pagamento
    const payment = new Payment(client);
    const paymentInfo = await payment.get({ id: payment_id });

    if (paymentInfo.status !== 'approved') {
      // Se o pagamento não foi aprovado, redirecione o usuário para uma página apropriada
      return res.redirect('/payment-pending');
    }

    // Se o pagamento foi aprovado, atualize o plano do usuário
    const validUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 dias a partir de agora
    const newFunnelLimit = PLAN_LIMITS[plan].funnels;

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        $set: {
          plan: plan,
          validUntil: validUntil,
          funnelLimit: newFunnelLimit, // Mantemos a atualização do funnelLimit
        },
        $push: {
          notifications: {
            title: `Plano ${plan} assinado ✅`,
            content: 'Bora aumentar suas vendas!',
            timestamp: new Date()
          }
        }
      },
      { new: true, runValidators: true }
    );

    if (!updatedUser) {
      throw new Error('Falha ao atualizar o usuário');
    }

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

    // Enviar mensagem de confirmação
    await avisar(user.phone, `Parabéns, ${user.name}! Seu plano ${plan} foi ativado com sucesso. Aproveite todos os recursos!`);

    res.render('plano-sucess', { 
      layout: false, 
      plan: plan,
      validUntil: validUntil.toLocaleDateString(),
      funnelLimit: newFunnelLimit
    });

  } catch (error) {
    console.error('Erro ao atualizar plano do usuário:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erro interno do servidor ao atualizar o plano',
      error: error.message
    });
  }
});

/*/
router.get('/update-user-plan', async (req, res) => {
  const { userId, plan } = req.query;

  if (!userId || !plan) {
    return res.status(400).json({ success: false, message: 'ID do usuário e plano são obrigatórios' });
  }

  if (!PLAN_LIMITS.hasOwnProperty(plan)) {
    return res.status(400).json({ success: false, message: 'Plano inválido' });
  }

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Usuário não encontrado' });
    }

    const newFunnelLimit = PLAN_LIMITS[plan];
    const newAutoResponseLimit = AUTO_RESPONSE_LIMITS[plan];
    const validUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 dias a partir de agora

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        $set: {
          plan: plan,
          validUntil: validUntil,
          funnelLimit: newFunnelLimit,
          autoResponseLimit: newAutoResponseLimit,
          autoResponseCount: 0 // Resetamos o contador ao mudar de plano
        },
        $push: {
          notifications: {
            title: `Plano ${plan} assinado ✅`,
            content: 'Bora aumentar suas vendas!',
            timestamp: new Date()
          }
        }
      },
      { new: true, runValidators: true }
    );

    if (!updatedUser) {
      throw new Error('Falha ao atualizar o usuário');
    }

    res.render('plano-sucess', { 
      layout: false, 
      plan: plan,
      validUntil: validUntil.toLocaleDateString(),
      funnelLimit: newFunnelLimit,
      autoResponseLimit: newAutoResponseLimit
    });

  } catch (error) {
    console.error('Erro ao atualizar plano do usuário:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erro interno do servidor ao atualizar o plano',
      error: error.message
    });
  }
});
/*/
router.post('/change-plan', async (req, res) => {
  const { userId, newPlan } = req.body;

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    // Obter o preço do novo plano
    const priceId = getPriceIdForPlan(newPlan);

    if (!priceId) {
      return res.status(400).json({ error: 'Plano inválido' });
    }

    // Criar a sessão de checkout
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      customer: user.stripeCustomerId,
      line_items: [
        {
          price: priceId,
          quantity: 1
        }
      ],
      mode: 'subscription',
      success_url: `${req.headers.origin}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.origin}/change-plan`
    });

    res.json({ id: session.id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

function getPriceIdForPlan(plan) {
  const priceIds = {
    gratuito: 'price_1PkajCJd0dkXl3iIIigFzsTG', // Exemplo de ID, substitua pelos seus IDs reais
    plus: 'price_1PlKbWJd0dkXl3iI1IsAG9FR',
    premium: 'price_1PlLFaJd0dkXl3iI4dVGf4Uw'
  };
  return priceIds[plan];
}





// Stripe webhook
router.post('/webhook', express.raw({type: 'application/json'}), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case 'customer.subscription.deleted':
    case 'customer.subscription.updated':
      const subscription = event.data.object;
      await handleSubscriptionChange(subscription);
      break;
    // ... handle other event types
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  res.json({received: true});
});

async function handleSubscriptionChange(subscription) {
  const user = await User.findOne({ stripeCustomerId: subscription.customer });
  if (!user) return;

  if (subscription.status === 'active') {
    user.plan = getPlanFromProductId(subscription.items.data[0].price.product);
    user.validUntil = new Date(subscription.current_period_end * 1000);
  } else {
    user.plan = 'gratuito';
    user.validUntil = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
  }

  await user.save();
}

function getPlanFromProductId(productId) {
  // Map your Stripe product IDs to plan names
  const productIdToPlan = {
    'price_1PkajCJd0dkXl3iIIigFzsTG': 'basico',
    'price_1PlKbWJd0dkXl3iI1IsAG9FR': 'plus',
    'price_1PlLFaJd0dkXl3iI4dVGf4Uw': 'premium'
  };
  return productIdToPlan[productId] || 'gratuito';
}

function formatWelcomeMessage(nome, code) {
  return `*Olá, ${nome}!* 🎉

Seja muito bem-vindo(a) ao *HocketZap*! 🚀💬

Estamos animados para ter você conosco. 😊

Seu código de verificação é:

🔐 *${code}* 🔐

_Por favor, insira este código no aplicativo para completar seu registro._

Lembre-se:
• Não compartilhe este código com ninguém
• O código expira em 10 minutos

Precisando de ajuda? Estamos aqui para você! 💪

Boas automações! 🤖✨

*Equipe HocketZap*`;
}

function formatPhoneNumber(num) {
  const cleaned = num.replace(/\D/g, '');
  const ddd = parseInt(cleaned.slice(0, 2));
  if (ddd <= 27) {
    return cleaned.padStart(13, '55'); // Ensure 11 digits for DDD <= 27
  } else {
    return cleaned.padStart(12, '55'); // Ensure 10 digits for DDD > 27
  }
}

async function sendTextMessage(num, msg) {
  const formattedNumber = num.replace(/\D/g, '');
  if (formattedNumber.length < 10 || formattedNumber.length > 15) {
    throw new Error('Número de telefone inválido');
  }

  const data = {
    id: formattedNumber,
    typeId: "user",
    message: msg,
    options: {
      delay: 0,
      replyFrom: ""
    },
    groupOptions: {
      markUser: "ghostMention"
    }
  };

  const config = {
    method: 'post',
    maxBodyLength: Infinity,
    url: `https://budzap.shop/message/text?key=${admtokenapi}`,
    headers: { 
      'Content-Type': 'application/json', 
      'Authorization': 'Bearer RANDOM_STRING_HERE', 
      'Cookie': 'connect.sid=s%3A4KArPPcKr6RWbooDdCu7FnXQCCJRhiqw.fW4prAd3ch3o4u2TV%2FFTSaCHsZrjVafDr8FhO5rHawA'
    },
    data: data
  };

  try {
    const response = await axios(config);
    console.log('Message sent successfully:', JSON.stringify(response.data));
    return response.data;
  } catch (error) {
    console.error('Error sending message:', error.message);
    if (error.response) {
      console.error('Error response:', error.response.data);
      throw new Error(`Falha ao enviar mensagem: ${error.response.data.message || 'Erro desconhecido'}`);
    }
    throw error;
  }

}





const generateVerificationCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

function formatarNumeroBrasileiro(numero) {
  // Remove todos os caracteres não numéricos
  numero = numero.replace(/\D/g, '');

  // Verifica se o número começa com 55 (DDI do Brasil)
  if (!numero.startsWith('55')) {
    return false;
  }

  // Remove o DDI
  numero = numero.slice(2);

  // Extrai o DDD
  const ddd = parseInt(numero.slice(0, 2));

  // Verifica se o DDD é válido
  if (ddd < 11 || ddd > 99) {
    return false;
  }

  // Aplica as regras de formatação
  if (ddd <= 27) {
    // DDD até 27: deve ter 11 dígitos
    if (numero.length < 11) {
      // Adiciona o 9 se estiver faltando
      numero = numero.slice(0, 2) + '9' + numero.slice(2);
    } else if (numero.length > 11) {
      // Remove dígitos extras
      numero = numero.slice(0, 11);
    }
  } else {
    // DDD 28 ou mais: deve ter 10 dígitos
    if (numero.length > 10) {
      // Remove o 9 extra ou dígitos adicionais
      numero = numero.slice(0, 2) + numero.slice(3).slice(0, 8);
    } else if (numero.length < 10) {
      // Número inválido se tiver menos de 10 dígitos
      return false;
    }
  }

  // Retorna o número formatado com o DDI
  return '55' + numero;
}

function formatPhoneNumber(number) {
  const cleaned = String(number).replace(/\D/g, '');

  if (/^\d{10,15}$/.test(cleaned)) {
    return cleaned;
  }

  const trimmed = cleaned.startsWith('55') ? cleaned.slice(2) : cleaned;

  return /^\d{10,15}$/.test(trimmed) ? trimmed : null;
}

router.get('/register', (req, res) => {
  res.render('register',  { layout: false, error: '', user: req.user });
});

const { check, validationResult } = require('express-validator');


router.get('/reset-password', (req, res) => {
  res.render('reset-password', {user: req.user, layout: false});
});

// Rota para enviar o código de verificação
router.post('/send-verification-code', async (req, res) => {
  const { phone } = req.body;
  try {
      const formattedNumber = formatPhoneNumber(phone);
      if (!formattedNumber) {
          return res.status(400).json({ success: false, message: 'Número de telefone inválido.' });
      }

      const numfinal = formattedNumber.startsWith('55') 
          ? await formatarNumeroBrasileiro(formattedNumber)
          : formattedNumber;

      const user = await User.findOne({ phone: numfinal });
      if (!user) {
          return res.status(404).json({ success: false, message: 'Usuário não encontrado' });
      }

      const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
      user.resetPasswordCode = verificationCode;
      user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
      await user.save();

      await avisar(numfinal, `Seu código de verificação para redefinir a senha é: ${verificationCode}`);

      res.json({ success: true, message: 'Código de verificação enviado' });
  } catch (error) {
      console.error('Erro ao enviar código de verificação:', error);
      res.status(500).json({ success: false, message: 'Erro ao enviar código de verificação' });
  }
});


// Rota para verificar o código
router.post('/verify-code', async (req, res) => {
  const { phone, code } = req.body;
  try {
      const formattedNumber = formatPhoneNumber(phone);
      if (!formattedNumber) {
          return res.status(400).json({ success: false, message: 'Número de telefone inválido.' });
      }

      const numfinal = formattedNumber.startsWith('55') 
          ? await formatarNumeroBrasileiro(formattedNumber)
          : formattedNumber;

      const user = await User.findOne({ 
          phone: numfinal, 
          resetPasswordCode: code,
          resetPasswordExpires: { $gt: Date.now() }
      });

      if (!user) {
          return res.status(400).json({ success: false, message: 'Código inválido ou expirado' });
      }

      const userInfo = {
          name: user.name,
          email: user.email,
          username: user.username,
          plan: user.plan
      };

      res.json({ success: true, message: 'Código verificado com sucesso', userInfo });
  } catch (error) {
      console.error('Erro ao verificar código:', error);
      res.status(500).json({ success: false, message: 'Erro ao verificar código' });
  }
});

// Rota para redefinir a senha
router.post('/reset-password', async (req, res) => {
  const { phone, newPassword } = req.body;
  try {
      const formattedNumber = formatPhoneNumber(phone);
      if (!formattedNumber) {
          return res.status(400).json({ success: false, message: 'Número de telefone inválido.' });
      }

      const numfinal = formattedNumber.startsWith('55') 
          ? await formatarNumeroBrasileiro(formattedNumber)
          : formattedNumber;

      const user = await User.findOne({ 
          phone: numfinal,
          resetPasswordExpires: { $gt: Date.now() }
      });

      if (!user) {
          return res.status(404).json({ success: false, message: 'Usuário não encontrado ou sessão de redefinição expirada' });
      }

      user.password = newPassword;
      user.resetPasswordCode = undefined;
      user.resetPasswordExpires = undefined;
      await user.save();

      res.json({ success: true, message: 'Senha redefinida com sucesso' });
  } catch (error) {
      console.error('Erro ao redefinir senha:', error);
      res.status(500).json({ success: false, message: 'Erro ao redefinir senha' });
  }
});

router.post('/register', [
  check('name').notEmpty().withMessage('Nome é obrigatório'),
  check('phone').notEmpty().withMessage('Telefone é obrigatório'),
  check('email').isEmail().withMessage('Email inválido'),
  check('username').notEmpty().withMessage('Username é obrigatório'),
  check('password').isLength({ min: 6 }).withMessage('A senha deve ter pelo menos 6 caracteres'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: errors.array()[0].msg });
  }

  try {
    const { name, phone, email, username, password } = req.body;

    // Verificar se o usuário já existe
    const existingUser = await User.findOne({ $or: [{ email }, { username }, { phone }] });
    if (existingUser) {
      if (existingUser.email === email) return res.status(400).json({ message: 'Este email já está em uso.' });
      if (existingUser.username === username) return res.status(400).json({ message: 'Este username já está em uso.' });
      if (existingUser.phone === phone) return res.status(400).json({ message: 'Este número de telefone já está em uso.' });
    }

    // Formatar número de telefone
    const formattedNumber = formatPhoneNumber(phone);
    if (!formattedNumber) {
      return res.status(400).json({ message: 'Número de telefone inválido.' });
    }

    const numfinal = formattedNumber.startsWith('55') 
      ? await formatarNumeroBrasileiro(formattedNumber)
      : formattedNumber;


    // Verificar o código de ativação
    /*/const validationKey = await ValidationKey.findOne({ key: activationCode, isUsed: false });
    if (!validationKey) {

      try {
        await sendTextMessage(phone, `Eii ${name}, para criar sua conta na budzap você precisa ter um código de ativação!\n\nℹ️ *Esse código de ativação é necessário para ativar sua conta.*\n\n❌  Parece que você não digitou o código, ou o código que você digitou é invalido"\n\nNão tem um código de ativação? 👇\n\nAssine um plano da budzap por aqui: https://app.hocketzap.comzapp \n\n✅ _Ao assinar um plano pelo site acima, você recebera o seu codigo de ativação para ativar sua conta de acordo com o plano que você adquiriu_`)
      } catch(e) {
     
        if (e.response && e.response.data) {
          console.log("Erro detalhado:", e.response.data)
          if(e.response.data.message.includes('não é um Whatsapp Valido')) {
            return res.status(400).json({ message: `O número ${phone} não é um whatsapp válido, digite seu numero correto!` });
          }
        }

        console.log("erro ao enviar msg no zap")
      }


      return res.status(400).json({ message: 'Código de ativação inválido ou já utilizado' });
   
    }/*/

  
   // validationKey.isUsed = true;
   // await validationKey.save();

   try {

   await sendTextMessage(phone, `👋 Oi, ${name}! Bem vindo ao nosso software! 🎉

Sua conta no Budzap tá prontinha e você já tá no plano gratuito. 💸
    
Quer começar a automatizar sua operação? É só escolher um plano e começar a escalar! 🚀
    
👉 Clique aqui para mudar de plano: https://hocketzap.com/change-plan
    
Assim que você escolher um plano, sua conta já vai ser ativada automaticamente. Fácil, né? 😎
    
    `)
    
    await sendTextMessage(phone, `🎩 *VEM FAZER PARTE DO NOSSO GRUPO DE BLACKHAT TAMBEM*

Trocar networking é essencial para evoluir sua operação.

🔱 Grupo: https://chat.whatsapp.com/Ba6vC7DcHXxIu4ZZRk0CfP
  `)

  const loginMessage = `Bem-vindo ao HocketZap, ${newUser.name}! 🎉\n\nSuas informações de login:\n\nUsername: ${newUser.username}\nEmail: ${newUser.email}\nTelefone: ${newUser.phone}\n\nGuarde essas informações em um local seguro. Você pode usar qualquer uma delas para fazer login.`;
  await sendTextMessage(phone, loginMessage);

     } catch(e) {
     
        if (e.response && e.response.data) {
          console.log("Erro detalhado:", e.response.data)
          if(e.response.data.message.includes('não é um Whatsapp Valido')) {
            return res.status(400).json({ message: `O número ${phone} não é um whatsapp válido, digite seu numero correto!` });
          }
        }

        console.log("erro ao enviar msg no zap")
      }



  // Criar cliente na Stripe
  const stripeCustomer = await stripe.customers.create({
    name,
    phone: numfinal,
    email: email
  });

     // Criar novo usuário
     const newUser = new User({
      name,
      phone: numfinal,
      email,
      username,
      password,
      plan: 'gratuito',
      stripeCustomerId: stripeCustomer.id,
      role: 'user',
      validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 ano a partir de agora
    });


    newUser.notifications.push({
      title: 'Registro Concluído',
      content: 'Seja muito bem vindo ao HocketZap 👋',
      timestamp: new Date()
    });

    // Salvar usuário no banco de dados
    await newUser.save();
    scheduleReminders(newUser);
    console.log('Novo usuário registrado:', newUser);


    
// Fazer login automático do usuário
    req.login(newUser, (err) => {
      if (err) {
        console.error('Erro ao fazer login automático:', err);
        return res.status(500).json({ message: 'Erro ao fazer login automático após o registro.' });
      }
      
      // Redirecionar para o dashboard
      return res.status(200).json({ message: 'Registro concluído com sucesso. Redirecionando para o dashboard.', redirect: '/dashboard' });
    });

  } catch (error) {
    console.error('Erro no registro:', error);
    res.status(500).json({ message: 'Erro no servidor ao registrar usuário.' });
  }
});


router.post('/complete-registration', async (req, res) => {
  const { phone, activationCode } = req.body;

  const formattedNumber = formatPhoneNumber(phone);
  if (!formattedNumber) {
    return res.status(400).json({ message: 'Número de telefone inválido.' });
  }
  const numfinal = formattedNumber.startsWith('55') 
    ? await formatarNumeroBrasileiro(formattedNumber)
    : formattedNumber;
  try {
    const user = await User.findOne({ phone: numfinal, isPhoneVerified: true });

    if (!user) {
      return res.status(400).json({ message: 'Usuário não encontrado ou telefone não verificado' });
    }

    // Encontrar a chave de validação válida
    const validationKey = await ValidationKey.findOne({ key: activationCode, isUsed: false });

    if (!validationKey) {
      return res.status(400).json({ message: 'Código de ativação inválido ou já utilizado' });
    }

    // Atualizar o usuário
    user.plan = validationKey.plan;
    user.validUntil = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 ano a partir de agora
    user.isActive = true;

    // Marcar a chave como usada e removê-la
    validationKey.isUsed = true;
    await validationKey.save();

    await user.save();

    res.json({ message: 'Registro concluído com sucesso', plan: user.plan });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erro no servidor' });
  }
});

router.get('/login', (req, res) => {
  console.log('Messages in login GET route:', res.locals.messages);
  res.render('login', { 
    layout: false,
    messages: res.locals.messages,
    user: req.user
  });
});



router.post('/login', (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    if (err) { 
      console.error('Erro na autenticação:', err);
      return res.render('login', { error: 'Ocorreu um erro durante o login.', layout: false, user: req.user });
    }
    if (!user) { 
      console.log('Login falhou:', info.message);
      return res.render('login', { error: info.message, layout: false, user: req.user });
    }
    req.logIn(user, (err) => {
      if (err) { 
        console.error('Erro ao fazer login:', err);
        return res.render('login', { error: 'Ocorreu um erro ao fazer login.',  layout: false, user: req.user });
      }
      console.log('Login bem-sucedido para:', user.username);
      return res.redirect('/dashboard');
    });
  })(req, res, next);
});

router.get('/logout', (req, res) => {
  req.logout((err) => {
    if (err) { return next(err); }
    req.session.destroy((err) => {
      res.redirect('/login');
    });
  });
});

module.exports = router;