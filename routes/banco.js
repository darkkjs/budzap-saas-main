const express = require('express');
const router = express.Router();
const User = require('../models/User'); // Ajuste o caminho conforme necessário
const { ensureAuthenticated } = require('../middleware/auth'); // Middleware de autenticação
const axios = require("axios")

// Rota para o extrato bancário
router.get('/extrato', ensureAuthenticated, async (req, res) => {
    try {

        // Renderizar a página do extrato bancário com os dados do Mercado Pago
        res.render('extrato', {
           
            user: req.user // Passa os dados do usuário para a view, se necessário
        });
    } catch (error) {
        console.error('Erro ao carregar dados do extrato bancário:', error);
        res.status(500).render('error', { message: 'Erro ao carregar o extrato bancário' });
    }
});

router.get('/mercadopago-activities', ensureAuthenticated, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('mercadopago');
        if (!user || !user.mercadopago) {
            return res.status(400).json({ error: 'Configuração do Mercado Pago não encontrada' });
        }

        const { xCsrfToken, xNewRelicId, cookie } = user.mercadopago;
        const page = req.query.page || 1;

        const response = await axios.get(`https://www.mercadopago.com.br/activities/api/activities/list?page=${page}&listing=activities&useEmbeddings=true`, {
            headers: {
                'accept': 'application/json, text/plain, */*',
                'accept-language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
                'x-csrf-token': xCsrfToken,
                'x-newrelic-id': xNewRelicId,
                'cookie': cookie
            }
        });

        // Calcular o saldo do dia
        const today = new Date().toISOString().split('T')[0]; // Data atual no formato YYYY-MM-DD
        const dailyBalance = response.data.results.reduce((acc, transaction) => {
            const transactionDate = transaction.creationDate.split('T')[0];
            if (transactionDate === today) {
                const amount = parseFloat(transaction.amount.fraction);
                if (!isNaN(amount)) {
                    if (transaction.type === 'pix_transfer_mi_movement' || 
                        (transaction.type === 'sale' && transaction.status.code !== 'rejected')) {
                        return acc + amount;
                    }
                }
            }
            return acc;
        }, 0);

        res.json({
            ...response.data,
            dailyBalance: dailyBalance.toFixed(2)
        });
    } catch (error) {
        console.error('Erro ao buscar atividades do Mercado Pago:', error);
        res.status(500).json({ error: 'Erro ao buscar atividades' });
    }
});

module.exports = router;