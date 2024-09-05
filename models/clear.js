const mongoose = require('mongoose');
const User = require('./User'); // Assumindo que o modelo User esteja em models/User.js

async function clearAllMessages() {
    try {
      const users = await User.find({ 'whatsappInstances.chats': { $exists: true, $not: { $size: 0 } } });
  
      for (const user of users) {
        console.log("limpand")
        user.whatsappInstances.forEach(instance => {
          if (instance.chats && instance.chats.length > 0) {
            instance.chats.forEach(chat => {
              chat.messages = []; // Limpa o array de mensagens
            });
          }
        });
  
        await user.save(); // Salva as mudanças para o usuário
      }
      
      console.log('Mensagens limpas com sucesso de todos os chats.');
    } catch (error) {
      console.error('Erro ao limpar mensagens:', error);
    }
  }
  

// Conecte-se ao MongoDB e execute a função
mongoose.connect('mongodb+srv://alancalhares123:senha123@cluster0.sgubjmv.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0', { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log('Conectado ao MongoDB');
 return clearAllMessages();
  })
  .then(() => mongoose.disconnect())
  .catch(error => {
    console.error('Erro ao conectar ao MongoDB:', error);
  });
