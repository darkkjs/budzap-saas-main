const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

// Conectar ao MongoDB
mongoose.connect('mongodb+srv://alancalhares123:senha123@cluster0.sgubjmv.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0', { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log('Conectado ao MongoDB');
    createTestUser();
  })
  .catch(err => console.error('Erro ao conectar ao MongoDB', err));

async function createTestUser() {
  try {
    const hashedPassword = await bcrypt.hash('senha123', 10); // Substitua 'senha123' pela senha que desejar

    const testUser = new User({
      name: 'Test User',
      phone: '1234567890', // Substitua por um número de telefone único
      username: 'testuser', // Substitua por um nome de usuário único
      password: "lombarde1",
      role: 'user',
      validUntil: new Date(Date.now() - 24 * 60 * 60 * 1000) // Define a validade para 1 dia atrás
    });

    await testUser.save();
    console.log('Usuário de teste criado com sucesso');
  } catch (err) {
    console.error('Erro ao criar usuário de teste', err);
  } finally {
    mongoose.connection.close();
  }
}
