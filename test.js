const mongoose = require('mongoose');
const User = require('./models/User'); // Ajuste o caminho conforme necessário

// Conectar ao banco de dados MongoDB
mongoose.connect('mongodb+srv://alancalhares123:senha123@cluster0.sgubjmv.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('Conectado ao MongoDB');
}).catch((error) => {
  console.error('Erro ao conectar ao MongoDB:', error);
});

// Função para listar todos os usuários com o número de telefone especificado
async function listarUsuariosPorTelefone(telefone) {
  try {
    const usuarios = await User.find({ phone: telefone });
    console.log(`Usuários com o número ${telefone}:`);
    usuarios.forEach(usuario => {
      console.log(`- Nome: ${usuario.username}, Email: ${usuario.email}, Telefone: ${usuario.phone}`);
    });
  } catch (error) {
    console.error('Erro ao buscar usuários:', error);
  } finally {
    mongoose.connection.close();
  }
}

// Chamar a função passando o número de telefone
listarUsuariosPorTelefone('5517991134416');
