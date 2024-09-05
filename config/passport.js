const LocalStrategy = require('passport-local').Strategy;
const User = require('../models/User');

module.exports = function(passport) {
  passport.use(new LocalStrategy(async (username, password, done) => {
    try {
      const user = await User.findOne({ username });

      if (!user) {
        console.log('Usuário não encontrado:', username);
        return done(null, false, { message: 'Nome de usuário não encontrado.' });
      }
      const isValid = await user.isValidPassword(password);
      if (!isValid) {
        console.log('Senha incorreta para o usuário:', username);
        return done(null, false, { message: 'Senha incorreta.' });
      }
      console.log('Login bem-sucedido para o usuário:', username);

      const now = new Date();
      
      // Verifica se a validade expirou e atualiza o plano se necessário
      if (user.validUntil && user.validUntil < now) {
        // Atualiza o plano para "gratuito" e define a validade como null
        await User.findByIdAndUpdate(user._id, {
          plan: 'gratuito',
          validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // Define a validade para 1 ano a partir de agora;,
          $push: {
            notifications: {
              title: 'Plano Expirado',
              content: 'Seu plano expirou e foi atualizado para o plano gratuito.',
              timestamp: now
            }
          }
        });

        // Atualiza o usuário no contexto da sessão
        user.plan = 'gratuito';
        user.validUntil = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // Define a validade para 1 ano a partir de agora;;
        user.notifications.push({
          title: 'Plano Expirado',
          content: 'Seu plano expirou e foi atualizado para o plano gratuito.',
          timestamp: now
        });
      }

      // Retorna o usuário, mesmo se o plano tiver sido atualizado
      return done(null, user);

    } catch (error) {
      return done(error);
    }
  })),
  

  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id, done) => {
    try {
      const user = await User.findById(id);
      done(null, user);
    } catch (error) {
      done(error);
    }
  });
};

