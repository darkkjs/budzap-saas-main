const User = require('../models/User');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');



// Função para ler o arquivo JSON de tons
async function readTonsConfig() {
    const configPath = path.join(__dirname, '../config/tons-eleven.json');
    const rawData = await fs.readFile(configPath, 'utf-8');
    return JSON.parse(rawData);
}


exports.checkElevenLabsConfig = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('elevenlabsApiKey elevenlabsVoiceId');
        
        if (!user) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }

        const isConfigured = !!(user.elevenlabsApiKey && user.elevenlabsVoiceId);

        res.json({
            configured: isConfigured,
            message: isConfigured ? 'ElevenLabs está configurado' : 'ElevenLabs não está configurado'
        });
    } catch (error) {
        console.error('Erro ao verificar configuração do ElevenLabs:', error);
        res.status(500).json({ error: 'Falha ao verificar configuração do ElevenLabs' });
    }
};

exports.saveMercadoPagoConfig = async (req, res) => {
    try {
        const { xCsrfToken, cookie, xNewRelicId } = req.body;

        // Validação básica
        if (!xCsrfToken || !cookie || !xNewRelicId) {
            return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
        }

        // Encontrar e atualizar o usuário
        const updatedUser = await User.findByIdAndUpdate(
            req.user.id,
            {
                'mercadopago.xCsrfToken': xCsrfToken,
                'mercadopago.cookie': cookie,
                'mercadopago.xNewRelicId': xNewRelicId,
                'mercadopago.integrationActive': true
            },
            { new: true, runValidators: true }
        );

        if (!updatedUser) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }

        res.status(200).json({
            message: 'Configuração do Mercado Pago salva com sucesso',
            config: {
                xCsrfToken: updatedUser.mercadopago.xCsrfToken,
                xNewRelicId: updatedUser.mercadopago.xNewRelicId,
                integrationActive: updatedUser.mercadopago.integrationActive
            }
        });
    } catch (error) {
        console.error('Erro ao salvar configuração do Mercado Pago:', error);
        res.status(500).json({ error: 'Erro interno do servidor ao salvar a configuração' });
    }
};



exports.getMercadoPagoConfig = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('mercadopago');
        
        // Renderiza a view EJS com os dados
        res.render('mercadopago-integration', {
            user: req.user,
            mercadoPagoConfig: user.mercadopago || {}
        });
    } catch (error) {
        console.error('Erro ao buscar configuração do Mercado Pago:', error);
        res.status(500).render('error', { message: 'Falha ao buscar configuração do Mercado Pago' });
    }
};

exports.testMercadoPagoIntegration = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user.mercadopago || !user.mercadopago.xCsrfToken || !user.mercadopago.cookie || !user.mercadopago.xNewRelicId) {
            return res.status(400).json({ error: 'Configuração do Mercado Pago incompleta' });
        }

        const response = await axios.get('https://www.mercadopago.com.br/activities/api/activities/list?period=last_two_weeks&page=1&listing=activities&useEmbeddings=true', {
            headers: {
                'accept': 'application/json, text/plain, */*',
                'accept-language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
                'sec-ch-ua': '"Not)A;Brand";v="99", "Google Chrome";v="127", "Chromium";v="127"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"Windows"',
                'sec-fetch-dest': 'empty',
                'sec-fetch-mode': 'cors',
                'sec-fetch-site': 'same-origin',
                'x-csrf-token': user.mercadopago.xCsrfToken,
                'x-newrelic-id': user.mercadopago.xNewRelicId,
                'cookie': user.mercadopago.cookie,
                'Referer': 'https://www.mercadopago.com.br/activities/1?period=last_two_weeks',
                'Referrer-Policy': 'no-referrer-when-downgrade'
            }
        });

        res.json({
            success: true,
            data: response.data // Você pode querer filtrar ou limitar os dados retornados aqui
        });
    } catch (error) {
        console.error('Erro ao testar integração do Mercado Pago:', error.response ? error.response.data : error.message);
        res.status(500).json({ error: 'Falha ao testar integração do Mercado Pago' });
    }
};

exports.saveElevenLabsConfig = async (req, res) => {
    try {
        const { apiKey, voiceId } = req.body;
        const userId = req.user.id;

        await User.findByIdAndUpdate(userId, {
            elevenlabsApiKey: apiKey,
            elevenlabsVoiceId: voiceId
        });

        res.status(200).json({ message: 'Configuração do ElevenLabs salva com sucesso' });
    } catch (error) {
        console.error('Erro ao salvar configuração do ElevenLabs:', error);
        res.status(500).json({ error: 'Falha ao salvar configuração do ElevenLabs' });
    }
};

exports.getElevenLabsConfig = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('elevenlabsApiKey elevenlabsVoiceId');
        if (!user) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }

        const tonsConfig = await readTonsConfig();

        res.json({
            elevenlabsApiKey: user.elevenlabsApiKey || '',
            elevenlabsVoiceId: user.elevenlabsVoiceId || '',
            tonsOptions: tonsConfig.map(ton => ({ nome: ton.nome, descricao: ton.descricao }))
        });
    } catch (error) {
        console.error('Erro ao buscar configuração do ElevenLabs:', error);
        res.status(500).json({ error: 'Falha ao buscar configuração do ElevenLabs' });
    }
};

exports.testElevenLabsIntegration = async (req, res) => {
    try {
        const { text, tom } = req.body;
        const user = await User.findById(req.user.id);

        if (!user.elevenlabsApiKey || !user.elevenlabsVoiceId) {
            return res.status(400).json({ error: 'Configuração do ElevenLabs não encontrada' });
        }

        const tonsConfig = await readTonsConfig();
        const selectedTon = tonsConfig.find(t => t.nome === tom);
        if (!selectedTon) {
            return res.status(400).json({ error: 'Tom selecionado não encontrado' });
        }

        const options = {
            method: 'POST',
            url: `https://api.elevenlabs.io/v1/text-to-speech/${user.elevenlabsVoiceId}`,
            headers: {
                'Accept': 'audio/mpeg',
                'xi-api-key': user.elevenlabsApiKey,
                'Content-Type': 'application/json'
            },
            data: {
                text: text,
                model_id: "eleven_multilingual_v2",
                voice_settings: {
                    stability: `0.${selectedTon.estabilidade}`,
                    similarity_boost: `0.${selectedTon.similaridade}`,
                    style: `0.${selectedTon.exagero}`,
                    use_speaker_boost: selectedTon.boost
                }
            },
            responseType: 'arraybuffer'
        };

        const response = await axios(options);

        res.set('Content-Type', 'audio/mpeg');
        res.send(Buffer.from(response.data, 'binary'));
    } catch (error) {
        console.error('Erro ao testar integração do ElevenLabs:', error);
        res.status(500).json({ error: 'Falha ao testar integração do ElevenLabs' });
    }
};

