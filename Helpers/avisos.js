
const axios = require("axios")

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

function formatPhoneNumber(num) {
  const cleaned = num.replace(/\D/g, '');
  const ddd = parseInt(cleaned.slice(0, 2));
  if (ddd <= 27) {
    return cleaned.padStart(13, '55'); // Ensure 11 digits for DDD <= 27
  } else {
    return cleaned.padStart(12, '55'); // Ensure 10 digits for DDD > 27
  }
}

async function avisar(num, msg) {
    const formattedNumber = formatPhoneNumber(num);
     if (!formattedNumber) {
       return res.status(400).json({ message: 'Número de telefone inválido.' });
     }
  
     const numfinal = formattedNumber.startsWith('55') 
       ? await formatarNumeroBrasileiro(formattedNumber)
       : formattedNumber;
  
  
    const data = {
      id: numfinal,
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
      url: `http://localhost:3333/message/text?key=${process.env.admtokenapi}`,
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
      throw error;
    }
  }

  module.exports = {
    avisar
};