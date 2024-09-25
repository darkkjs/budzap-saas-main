//API DE RECEBIMENTO DE PIX E CHECAGEM DE STATUS  DA PAGBANK
const axios = require("axios")


async function criarPedidoPagSeguro(token, dadosPedido) {
  try {
    const resposta = await axios({
      method: 'post',
      url: 'https://api.pagseguro.com/orders',
      headers: {
        'Authorization': `Bearer ${token}`,
        'accept': 'application/json',
        'content-type': 'application/json'
      },
      data: dadosPedido
    });

    console.log('Pedido criado com sucesso:', resposta.data);
    return resposta.data;
  } catch (erro) {
    console.error('Erro ao criar pedido:', erro.response ? erro.response.data : erro.message);
    throw erro;
  }
}


// O erro indica que as credenciais são inválidas. Verifique se o token está correto e atualizado.
const token = '73009779-42ab-4ff0-80a1-d7fea6b1ba081a5fad904a9c93b17edcc4afad624079c217-100f-42f0-9010-7e20d4fb0d2f';

const dadosPedido = {
  reference_id: "ex-00001",
  customer: {
    name: "Jose da Silva",
    email: "email@test.com",
    tax_id: "12345678909",
    phones: [
      {
        country: "55",
        area: "11",
        number: "999999999",
        type: "MOBILE"
      }
    ]
  },
  items: [
    {
      reference_id: "referencia do item",
      name: "nome do item",
      quantity: 1,
      unit_amount: 500
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
  notification_urls: [
    "https://meusite.com/notificacoes"
  ]
};

criarPedidoPagSeguro(token, dadosPedido)
  .then(resultado => console.log(resultado))
  .catch(erro => console.error('Erro detalhado:', erro.response ? erro.response.data : erro.message));
