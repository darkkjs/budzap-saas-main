require('dotenv').config();
const eventBus = require('./Helpers/eventBus');

// Verificação da chave API
if (!process.env.STRIPE_SECRET_KEY) {
  console.error('A chave secreta do Stripe não está definida. Por favor, configure a variável de ambiente STRIPE_SECRET_KEY.');
  process.exit(1);
}

const express = require('express');
const mongoose = require('mongoose');
const passport = require('passport');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const flash = require('connect-flash');
const User = require('./models/User');
const app = express();
const fs = require('fs');
const path = require('path');
const multer = require("multer");
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const axios = require("axios")
// Cria o diretório de uploads se ele não existir
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)){
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Conectar ao MongoDB
mongoose.connect('mongodb+srv://alancalhares123:senha123@cluster0.sgubjmv.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0', { useNewUrlParser: true, useUnifiedTopology: true });

// Configurações
const expressLayouts = require('express-ejs-layouts');

const http = require('http').createServer(app);
const io = require('socket.io')(http);
const { getChats, getMessages, saveAndSendMessage } = require('./Helpers/redisHelpers');

app.set('io', io);

io.on('connection', (socket) => {
  console.log('Um usuário se conectou');
  
  socket.on('join instance', (instanceKey) => {
      console.log(`Cliente tentando entrar na instância: ${instanceKey}`);
      socket.join(instanceKey);
      console.log(`Cliente entrou na instância: ${instanceKey}`);
  });

  socket.on('request initial chats', async (instanceKey) => {
      const chats = await fetchInitialChats(instanceKey);
      socket.emit('initial chats', chats);
  });

  socket.on('request chat messages', async (instanceKey, chatId) => {
      const messages = await fetchChatMessages(instanceKey, chatId);
      socket.emit('chat messages', { chatId, messages });
  });

  socket.on('send message', async (data) => {
      const { instanceKey, chatId, content } = data;
      const message = await saveAndSendMessage(instanceKey, chatId, content);
      console.log("msg nova")
      io.to(instanceKey).emit('new message', { chatId, message });
  });

  socket.on('disconnect', () => {
      console.log('Um usuário se desconectou');
  });
});

// Escutar eventos do eventBus e emitir para o socket
eventBus.on('newMessage', (instanceKey, data) => {
  console.log("EVENTBUS DE MENSAGEM NOVA")
  io.to(instanceKey).emit('new message', data);
});

eventBus.on('status', (instanceKey, data) => {
  console.log("EVENTBUS DE STATUS NOVO")
  io.to(instanceKey).emit('status', data);
});


async function fetchInitialChats(instanceKey) {
    try {
        const chats = await getChats(instanceKey);
        return chats.sort((a, b) => b.lastMessageTimestamp - a.lastMessageTimestamp);
    } catch (error) {
        console.error('Erro ao buscar chats iniciais:', error);
        return [];
    }
}

async function fetchChatMessages(instanceKey, chatId, limit = 50) {
  try {
      const messages = await getMessages(instanceKey, chatId, limit);
      return messages.sort((a, b) => a.timestamp - b.timestamp);
  } catch (error) {
      console.error('Erro ao buscar mensagens do chat:', error);
      return [];
  }
}




app.use(expressLayouts);
app.set('layout', 'layout');
app.set('view engine', 'ejs');

// Aumentar o limite do body-parser
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use(express.static('public'));

// Configuração da sessão
app.use(session({
  secret: 'darklindo',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 * 7 // 1 semana
  },
  store: MongoStore.create({ mongoUrl: 'mongodb+srv://alancalhares123:senha123@cluster0.sgubjmv.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0' })
}));

// Configurar flash middleware
app.use(flash());

// Inicializar Passport
app.use(passport.initialize());
app.use(passport.session());
require('./config/passport')(passport);

app.use((req, res, next) => {
  req.io = io;
  res.locals.messages = req.flash();
  next();
});

// Tratamento de erros para Multer
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    req.flash('error_msg', `Erro de upload: ${err.message}`);
    return res.redirect('/profile');
  } else if (err) {
    console.error(err);
    req.flash('error_msg', 'Ocorreu um erro durante o upload');
    return res.redirect('/profile');
  }
  next();
});

// Serialização do usuário
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// Desserialização do usuário
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err);
  }
});

// Rotas

const catalogRoutes = require('./routes/catalogRoutes');
app.use('/catalog', catalogRoutes);


const pageRoutes = require('./routes/pageRoutes');

// ... (outras configurações)

app.use('/pages', pageRoutes);

const subscriptionRoutes = require('./routes/subscription');
app.use('/subscription', subscriptionRoutes);
const webhookController = require('./controllers/webhookController');
app.post('/pagbank-pix', webhookController.handlePagBankPixWebhook);

const minioClient = require('./config/minioConfig');
const { Readable } = require('stream');

app.get('/media/:filename', async (req, res) => {
  const bucketName = 'chat-media';
  const fileName = req.params.filename;

  try {
    const stream = await minioClient.getObject(bucketName, fileName);
    stream.pipe(res);
  } catch (error) {
    console.error('Error serving media:', error);
    res.status(404).send('Media not found');
  }
});


const whatsappCampaignRoutes = require('./routes/whatsappCampaign');
const redirectRoutes = require('./routes/redirect');

app.use('/api/whatsapp-campaigns', whatsappCampaignRoutes);
app.use('/r', redirectRoutes);

// Em qualquer arquivo onde você precisa usar essas funções:
const stripeHelpers = require('./Helpers/stripeHelpers');

// Exemplo de uso em uma rota ou controller:
app.post('/create-checkout-session', async (req, res) => {
    const { planKey } = req.body;
    const userId = req.user.id;
console.log(planKey)
    try {
        const session = await stripeHelpers.createCheckoutSession(
            userId,
            planKey,
            `${req.protocol}://${req.get('host')}/subscription/subscription-success?id={CHECKOUT_SESSION_ID}&userId=${req.user.id}`,
            `${req.protocol}://${req.get('host')}/change-plan`
        );

        res.json({ id: session.id });
    } catch (error) {
        console.error('Error creating checkout session:', error);
        res.status(500).json({ error: error.message });
    }
});


app.get('/events', (req, res) => {
  res.render('events', {user: req.user});
});

// Exemplo de uso da função getPlanFromPriceId:
app.get('/subscription-details', async (req, res) => {
    const subscription = await stripeHelpers.retrieveSubscription(req.user.stripeSubscriptionIde);
    const planName = stripeHelpers.getPlanFromPriceId(subscription.items.data[0].price.id);
    
    res.json({ plan: planName });
});


app.use('/', require('./routes/auth'));
app.use('/api-events', require('./routes/events'));
app.use('/profile', require('./routes/profile'));
app.use('/funcoes', require('./routes/someFeature'));
app.use('/admin', require('./routes/admin'));
app.use('/dashboard', require('./routes/dashboard'));

const webhookRouter = require('./routes/webhook');
app.use('/webhook', webhookRouter);

const whatsappInstancesRoutes = require('./routes/whatsappInstances');
app.use('/whatsapp', whatsappInstancesRoutes);

const chatCleanupRoutes = require('./routes/chatCleanupRoutes');
app.use('/clear', chatCleanupRoutes);

const funnelRoutes = require('./routes/funnelRoutes');
app.use('/funnels', funnelRoutes);

const whatsappRoutes = require('./routes/funcoeszap');
app.use('/funcao', whatsappRoutes);

app.use('/group', require('./routes/groupManagement'));

app.use('/app', require('./routes/messages'));

app.use('/chat', require('./routes/chatRoutes'));

const autoResponseRouter = require('./routes/autoResponse');
app.use('/auto-response', autoResponseRouter);

const analyticsController = require('./controllers/analyticsController');
const { ensureAuthenticated } = require('./middleware/auth');
const settingsController = require('./controllers/settingsController');

app.get('/settings', ensureAuthenticated, settingsController.getSettings);
app.post('/settings/update', ensureAuthenticated, settingsController.updateSettings);

app.get('/analytics', ensureAuthenticated, analyticsController.getAnalytics);

const notificationsRoutes = require('./routes/notifications');
app.use('/notifications', notificationsRoutes);

app.use('/integrations', require('./routes/integrations'));

const elevenlabsWhatsappRoutes = require('./routes/zapvoice-master');
app.use('/zapvoice', elevenlabsWhatsappRoutes);

const bankStatementRoutes = require('./routes/banco'); 
app.use('/banco', bankStatementRoutes);

const paymentRoutes = require('./routes/paymentRoutes');
const webhookRoutes = require('./routes/webhookRoutes');

app.use('/payments', paymentRoutes);
app.use('/api/webhook', webhookRoutes);


app.post('/test-api-request', async (req, res) => {
  const { url, method, body, headers } = req.body;
  let parsedHeaders;
  
  try {
    // Se headers forem enviados como string JSON, parse para um objeto
    if (headers) {
      parsedHeaders = JSON.parse(headers); // Corrigido para transformar a string JSON em objeto
    }

    const response = await axios({
      method: method,
      url: url,
      data: body ? JSON.parse(body) : undefined,
      headers: parsedHeaders || {},  // Usa headers parseados
      timeout: 10000 // 10 segundos de timeout
    });

    res.json({
      success: true,
      status: response.status,
      statusText: response.statusText,
      data: response.data,
      headers: response.headers
    });
  } catch (error) {
    console.log(error);
    console.log(parsedHeaders)
    res.status(500).json({
      success: false,
      error: error.message,
      response: error.response ? {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data
      } : null
    });
  }
});


const PORT = process.env.PORT || 3332;
http.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));

module.exports = io;