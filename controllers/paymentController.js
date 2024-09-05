const axios = require('axios');
const User = require('../models/User');
const Order = require('../models/Order');

const PAGBANK_API_URL = 'https://sandbox.api.pagseguro.com';
const PAGBANK_TOKEN = '3B57808251494FDA801F01B96ECF9BCC';

// Função para formatar o número de telefone
const formatPhoneNumber = (num) => {
  const cleaned = num.replace(/\D/g, '');
  const ddd = parseInt(cleaned.slice(0, 2));
  return ddd <= 27 ? cleaned.padStart(13, '55') : cleaned.padStart(12, '55');
};

const formatarNumeroBrasileiro = (numero) => {
  numero = numero.replace(/\D/g, '');
  if (!numero.startsWith('55')) return false;
  
  numero = numero.slice(2);
  const ddd = parseInt(numero.slice(0, 2));
  if (ddd < 11 || ddd > 99) return false;

  if (ddd <= 27) {
    numero = numero.length < 11 ? numero.slice(0, 2) + '9' + numero.slice(2) : numero.slice(0, 11);
  } else {
    numero = numero.length > 10 ? numero.slice(0, 2) + numero.slice(3).slice(0, 8) : numero;
    if (numero.length < 10) return false;
  }

  return '55' + numero;
};

// Função para obter o preço do plano
const getPlanPrice = (plan) => {
  const prices = { basic: 2990, premium: 4990 };
  const price = prices[plan] || 0;
  return Math.max(1, Math.min(price, 999999900));
};

// Função para lidar com erros de requisição
const handleRequestError = (error, res) => {
  if (error.response) {
    console.error('Erro na resposta da API:', error.response.data);
    res.status(error.response.status).json({ error: error.response.data });
  } else if (error.request) {
    console.error('Nenhuma resposta recebida da API:', error.request);
    res.status(500).json({ error: 'Nenhuma resposta recebida da API PagBank' });
  } else {
    console.error('Erro ao configurar a requisição:', error);
    res.status(500).json({ error: 'Erro ao configurar a requisição' });
  }
};

// Função para gerar os dados da ordem
const generateOrderData = (user, plan, paymentMethod, cardData, phone, cpf) => {
  const planPrice = getPlanPrice(plan);
  
  const orderData = {
    customer: {
      name: user.name,
      email: user.email,
      tax_id: '12345678909',
      phones: [
        {
          country: "55",
          area: phone.slice(2, 4),
          number: phone.slice(4),
          type: "MOBILE"
        }
      ]
    },
    items: [
      {
        name: "Plano de Assinatura",
        quantity: 1,
        unit_amount: planPrice
      }
    ],
    shipping: {
      address: {
        street: "Avenida Brigadeiro Faria Lima",
        number: "1384",
        complement: "apto 12",
        locality: "Pinheiros",
        city: "São Paulo",
        region_code: "SP",
        country: "BRA",
        postal_code: "01452002"
      }
    },
    notification_urls: ["https://meusite.com/notificacoes"]
  };

  if (paymentMethod.toUpperCase() === 'PIX') {
    orderData.payment_method = {
      type: 'PIX',
      pix: {
        expiration_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        additional_information: [
          { name: 'Plano', value: plan }
        ]
      }
    };
  } else if (paymentMethod.toUpperCase() === 'CREDIT_CARD') {
    orderData.payment_method = {
      type: "CREDIT_CARD",
      installments: 1,
      capture: true,
      card: {
        number: cardData.number,
        exp_month: cardData.expMonth,
        exp_year: cardData.expYear,
        security_code: cardData.securityCode,
        holder: {
          name: cardData.holderName,
          tax_id: cpf
        }
      }
    };
  }

  return orderData;
};

// Função principal para criar a ordem
exports.createOrder = async (req, res) => {
  const { plan, paymentMethod, cardData, phone, cpf } = req.body;

  try {
    const formattedNumber = formatPhoneNumber("55" + phone);
    if (!formattedNumber) {
      return res.status(400).json({ message: 'Número de telefone inválido.' });
    }

    const numfinal = formattedNumber.startsWith('55') 
      ? await formatarNumeroBrasileiro(formattedNumber)
      : formattedNumber;

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const orderData = generateOrderData(user, plan, paymentMethod, cardData, numfinal, cpf);
    console.log('Order Data:', JSON.stringify(orderData, null, 2));

    const response = await axios.post(`${PAGBANK_API_URL}/orders`, orderData, {
      headers: {
        'Authorization': `Bearer ${PAGBANK_TOKEN}`,
        'Content-Type': 'application/json',
        'x-api-version': '4.0'
      }
    });

    console.log('PagBank Response:', response.data);

    const order = new Order({
      userId: user._id,
      orderId: response.data.id,
      plan: plan,
      paymentMethod: paymentMethod,
      status: 'pending'
    });

    await order.save();

    let responseData = {
      orderId: response.data.id,
      paymentMethod: paymentMethod,
      status: 'pending'
    };

    if (paymentMethod.toUpperCase() === 'PIX') {
      // Verificar se existe um link para o QR code do PIX
      const qrCodeLink = response.data.qr_codes && response.data.qr_codes[0]?.links?.find(link => link.media === 'image/png');
      if (qrCodeLink) {
        responseData.qrCode = qrCodeLink.href;
      } else {
        console.warn('QR Code do PIX não encontrado na resposta da API');
      }
    }

    res.json(responseData);

  } catch (error) {
    handleRequestError(error, res);
  }
};

// Função para obter o status da ordem
exports.getOrderStatus = async (req, res) => {
  const { orderId } = req.params;

  try {
    const order = await Order.findOne({ orderId: orderId });
    if (!order) {
      return res.status(404).json({ error: 'Pedido não encontrado' });
    }

    res.json({ status: order.status });

  } catch (error) {
    console.error('Erro ao buscar status do pedido:', error);
    res.status(500).json({ error: 'Falha ao buscar status do pedido' });
  }
};
