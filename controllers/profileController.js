
// controllers/profileController.js
const User = require('../models/User');
const bcrypt = require('bcryptjs');

exports.getProfilePage = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).render('error', { message: 'Usuário não encontrado' });
        }
        res.render('profile', { 
            title: 'Perfil', 
            user,
            messages: req.flash() // Adicione isso
        });
    } catch (error) {
        console.error('Erro ao carregar perfil:', error);
        res.status(500).render('error', { message: 'Erro ao carregar página de perfil' });
    }
};

exports.verifyPassword = async (req, res) => {
  const { currentPassword } = req.body;
  const user = await User.findById(req.user.id);

  if (await user.isValidPassword(currentPassword)) {
      res.json({ isValid: true });
  } else {
      res.json({ isValid: false });
  }
};


exports.updateProfile = async (req, res) => {
  try {
    const { name, email, phone } = req.body;
    await User.findByIdAndUpdate(req.user.id, { name, email, phone });
    req.flash('success_msg', 'Perfil atualizado com sucesso');
    res.redirect('/profile');
  } catch (error) {
    console.error('Erro ao atualizar perfil:', error);
    req.flash('error_msg', 'Erro ao atualizar perfil');
    res.redirect('/profile');
  }
};

exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    const user = await User.findById(req.user.id);

    if (!(await bcrypt.compare(currentPassword, user.password))) {
      req.flash('error_msg', 'Senha atual incorreta');
      return res.redirect('/profile');
    }

    if (newPassword !== confirmPassword) {
      req.flash('error_msg', 'As novas senhas não coincidem');
      return res.redirect('/profile');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    req.flash('success_msg', 'Senha alterada com sucesso');
    res.redirect('/profile');
  } catch (error) {
    console.error('Erro ao alterar senha:', error);
    req.flash('error_msg', 'Erro ao alterar senha');
    res.redirect('/profile');
  }
};

exports.updateUsername = async (req, res) => {
  try {
    const { newUsername } = req.body;
    const existingUser = await User.findOne({ username: newUsername });

    if (existingUser) {
      req.flash('error_msg', 'Este nome de usuário já está em uso');
      return res.redirect('/profile');
    }

    await User.findByIdAndUpdate(req.user.id, { username: newUsername });
    req.flash('success_msg', 'Nome de usuário atualizado com sucesso');
    res.redirect('/profile');
  } catch (error) {
    console.error('Erro ao atualizar nome de usuário:', error);
    req.flash('error_msg', 'Erro ao atualizar nome de usuário');
    res.redirect('/profile');
  }
};

exports.uploadProfileImage = async (req, res) => {
  try {
    if (!req.file) {
      req.flash('error_msg', 'Nenhuma imagem selecionada');
      return res.redirect('/profile');
    }

    const profileImage = `/uploads/${req.file.filename}`;
    await User.findByIdAndUpdate(req.user.id, { profileImage });

    req.flash('success_msg', 'Imagem de perfil atualizada com sucesso');
    res.redirect('/profile');
  } catch (error) {
    console.error('Erro ao fazer upload da imagem:', error);
    req.flash('error_msg', 'Erro ao fazer upload da imagem');
    res.redirect('/profile');
  }
};