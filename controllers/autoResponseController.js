const redisClient = require('../config/redisConfig');
const { executeFunnel, sendTextMessage } = require('../services/funnelExecutor');
const colors = require('colors');
const AUTO_RESPONSE_EXPIRY = 60 * 60; // 1 hora em segundos
const { AUTO_RESPONSE_LIMITS } = require('../config/planLimits');

// Atualiza campanhas de autoresposta
exports.updateCampaigns = async (req, res) => {
    try {
        const { instanceKey, campaigns } = req.body;
        const campaignsKey = `auto_response_campaigns:${instanceKey}`;

        // Validar se todas as campanhas têm um funnelId
        const validCampaigns = campaigns.filter(campaign => campaign.funnelId);
        
        if (validCampaigns.length !== campaigns.length) {
            console.warn(`Algumas campanhas não têm funnelId. Total: ${campaigns.length}, Válidas: ${validCampaigns.length}`);
        }

        await redisClient.set(campaignsKey, JSON.stringify(validCampaigns));

        res.json({ success: true, message: 'Campanhas de autoresposta atualizadas com sucesso' });
    } catch (error) {
        console.error('Erro ao atualizar campanhas:', error);
        res.status(500).json({ error: 'Erro ao atualizar campanhas de autoresposta' });
    }
};
// Obtém campanhas de autoresposta
exports.getCampaigns = async (req, res) => {
    const { instanceKey } = req.params;
    const campaignsKey = `auto_response_campaigns:${instanceKey}`;

    try {
        const campaignsData = await redisClient.get(campaignsKey);
        const campaigns = campaignsData ? JSON.parse(campaignsData) : [];
        return res.json({ success: true, campaigns });
    } catch (error) {
        console.error('Erro ao buscar campanhas:', error);
        return res.status(500).json({ error: 'Erro ao buscar campanhas de autoresposta' });
    }
};


async function saveLastMessage(instanceKey, chatId, message) {
    const key = `last_message:${instanceKey}:${chatId}`;
    await redisClient.set(key, message);
    await redisClient.expire(key, AUTO_RESPONSE_EXPIRY);
}

// Processa autoresposta com base na campanha
exports.handleAutoResponse = async (instanceKey, chatId, message) => {
    try {
        console.log('Processando autoresposta para:'.cyan, { instanceKey, chatId, message });
        
        const autoResponseKey = `auto_response:${instanceKey}:${chatId}`;
        const currentState = await redisClient.get(autoResponseKey);
        await saveLastMessage(instanceKey, chatId, message);
        if (currentState) {
            let state = JSON.parse(currentState);
            console.log('Estado atual:'.yellow, JSON.stringify(state, null, 2));
            
            if (state.status === 'waiting_for_input') {
                state.userInputs[state.expectedInput] = message;
                state.status = 'in_progress';
                
                console.log('Estado atualizado após input:'.green, JSON.stringify(state, null, 2));

                const funnel = await getFunnelFromRedis(state.funnelId);
                if (funnel) {
                    // Encontrar o próximo nó após o input
                    const currentNode = funnel.nodes.find(node => node.id === state.currentNodeId);
                    const nextConnection = funnel.connections.find(conn => conn.sourceId === currentNode.id);
                    state.currentNodeId = nextConnection ? nextConnection.targetId : null;

                    await redisClient.setex(autoResponseKey, AUTO_RESPONSE_EXPIRY, JSON.stringify(state));
                    await executeFunnel(funnel, chatId, instanceKey, state);
                } else {
                    console.error('Funil não encontrado:'.red, state.funnelId);
                }
                return;
            }
        }

        // Se não estiver em um estado de espera, processa como uma nova autoresposta
        const campaignsKey = `auto_response_campaigns:${instanceKey}`;
        const campaignsData = await redisClient.get(campaignsKey);
        const campaigns = campaignsData ? JSON.parse(campaignsData) : [];

        for (const campaign of campaigns) {
            if (campaign.isActive && shouldExecuteCampaign(campaign, message)) {
                console.log(`Executando campanha:`.green, campaign.name);
                await executeCampaign(instanceKey, chatId, message, campaign);
                return;
            }
        }

        console.log('Nenhuma campanha correspondente encontrada'.yellow);
    } catch (error) {
        console.error('Erro ao processar autoresposta:'.red, error);
    }
};

// Processa estado atual da autoresposta
async function processCurrentState(autoResponseKey, chatId, instanceKey, currentState, message) {
    const state = JSON.parse(currentState);
    if (state.status === 'waiting_for_input') {
        state.userInputs[state.expectedInput] = message;
        state.status = 'in_progress';
        await redisClient.setex(autoResponseKey, AUTO_RESPONSE_EXPIRY, JSON.stringify(state));
        
        const funnel = await getFunnelFromRedis(state.funnelId);
        if (funnel) {
            await executeFunnel(funnel, chatId, instanceKey, state);
        }
    }
}

async function getFunnelFromRedis(funnelId) {
    const funnelKey = `funnel:${funnelId}`;
    const funnelData = await redisClient.get(funnelKey);
    if (!funnelData) {
        console.error(`Funil não encontrado no Redis: ${funnelId}`);
        return null;
    }
    return JSON.parse(funnelData);
}

// Verifica se a campanha deve ser executada
function shouldExecuteCampaign(campaign, message) {
    const lowerCaseMessage = message.toLowerCase();
    switch (campaign.condition) {
        case 'all':
            return true;
        case 'startsWith':
            return lowerCaseMessage.startsWith(campaign.value.toLowerCase());
        case 'contains':
            return lowerCaseMessage.includes(campaign.value.toLowerCase());
        case 'equals':
            return lowerCaseMessage === campaign.value.toLowerCase();
        case 'regex':
            return new RegExp(campaign.value, 'i').test(lowerCaseMessage);
        default:
            return false;
    }
}

// Registra a ativação da campanha
async function recordCampaignActivation(instanceKey, campaignName, chatId) {
    const activationsKey = `campaign_activations:${instanceKey}:${campaignName}`;
    const reportsKey = `auto_response_reports:${instanceKey}`;
    const userUsageKey = `user_auto_response_usage:${instanceKey}`;

    try {
        await redisClient.incr(activationsKey);
        await redisClient.incr(userUsageKey);

        const report = JSON.stringify({
            campaignName,
            chatId,
            timestamp: new Date().toISOString(),
        });
        await redisClient.lpush(reportsKey, report);
        await redisClient.ltrim(reportsKey, 0, 99);

        console.log(`Ativação de campanha registrada: ${campaignName}`.green);
        console.log(`Uso de autoresposta incrementado para a instância: ${instanceKey}`.green);
    } catch (error) {
        console.error('Erro ao registrar ativação de campanha:', error);
    }
}

async function checkCampaignsIntegrity(instanceKey) {
    const campaignsKey = `auto_response_campaigns:${instanceKey}`;
    const campaignsData = await redisClient.get(campaignsKey);
    const campaigns = campaignsData ? JSON.parse(campaignsData) : [];

    const validCampaigns = campaigns.filter(campaign => campaign.funnelId);
    
    if (validCampaigns.length !== campaigns.length) {
        console.warn(`Campanhas inválidas encontradas para a instância ${instanceKey}. Total: ${campaigns.length}, Válidas: ${validCampaigns.length}`);
        await redisClient.set(campaignsKey, JSON.stringify(validCampaigns));
    }
}


async function executeCampaign(instanceKey, chatId, message, campaign) {
    const funnel = await getFunnelFromRedis(campaign.funnelId);
    if (!funnel) {
        console.error('Funil não encontrado:'.red, campaign.funnelId);
        return;
    }

    console.log(`Iniciando execução do funil:`.green, funnel.name);

    const initialState = {
        funnelId: funnel.id,
        currentNodeId: funnel.nodes[0].id,
        status: 'in_progress',
        userInputs: {},
        lastMessage: message
    };

    const autoResponseKey = `auto_response:${instanceKey}:${chatId}`;
    await redisClient.setex(autoResponseKey, AUTO_RESPONSE_EXPIRY, JSON.stringify(initialState));

    await executeFunnel(funnel, chatId, instanceKey, initialState);
}

// Relatório de autoresposta
exports.getAutoResponseReport = async (req, res) => {
    const { instanceKey } = req.params;
    const reportsKey = `auto_response_reports:${instanceKey}`;
    const campaignsKey = `auto_response_campaigns:${instanceKey}`;
    const userUsageKey = `user_auto_response_usage:${instanceKey}`;

    try {
        const [reportsData, campaignsData, totalUsage] = await Promise.all([
            redisClient.lrange(reportsKey, 0, 9),
            redisClient.get(campaignsKey),
            redisClient.get(userUsageKey),
        ]);

        const recentResponses = reportsData.map((report) => {
            const { campaignName, chatId, timestamp } = JSON.parse(report);
            return {
                campaignName,
                phoneNumber: chatId.split('@')[0],
                timestamp,
            };
        });

        const campaigns = JSON.parse(campaignsData || '[]');
        const campaignActivations = {};

        await Promise.all(
            campaigns.map(async (campaign) => {
                const activationsKey = `campaign_activations:${instanceKey}:${campaign.name}`;
                const count = await redisClient.get(activationsKey);
                campaignActivations[campaign.name] = parseInt(count || '0');
            })
        );

        res.json({
            success: true,
            totalResponses: parseInt(totalUsage || '0'),
            recentResponses,
            campaignActivations,
        });
    } catch (error) {
        console.error('Erro ao gerar relatório:', error);
        res.status(500).json({ success: false, error: 'Erro ao gerar relatório' });
    }
};

// Uso de autoresposta por usuário
exports.getAutoResponseUsage = async (req, res) => {
    const { instanceKey } = req.params;
    const userKey = `user:${req.user.id}`;

    try {
        const [userPlan, autoResponseCount] = await Promise.all([
            redisClient.hget(userKey, 'plan'),
            redisClient.hget(userKey, 'autoResponseCount'),
        ]);

        const isPremium = userPlan === 'premium';
        const limit = AUTO_RESPONSE_LIMITS[userPlan];
        const usage = parseInt(autoResponseCount) || 0;

        res.json({
            success: true,
            usage,
            limit: isPremium ? Infinity : limit,
            isPremium,
        });
    } catch (error) {
        console.error('Erro ao obter uso de autoresposta:', error);
        res.status(500).json({ success: false, error: 'Erro ao obter uso de autoresposta' });
    }
};

// Inicia nova autoresposta
exports.startNewAutoResponse = async (instanceKey, chatId, initialMessage) => {
    console.log('Iniciando nova autoresposta:'.cyan, { instanceKey, chatId, initialMessage });

    const instanceData = await redisClient.hgetall(`instance:${instanceKey}`);
    
    if (!instanceData || !instanceData.autoResponseActive || !instanceData.autoResponseFunnelId) {
        return console.log('Autoresposta não está ativa para esta instância'.yellow);
    }

    const funnel = await getFunnelFromRedis(instanceData.autoResponseFunnelId);
    if (!funnel) {
        return console.error('Funil não encontrado:', instanceData.autoResponseFunnelId);
    }

    const initialState = {
        funnelId: funnel.id,
        currentNodeId: funnel.nodes[0].id,
        status: 'in_progress',
        userInputs: {},
        lastMessage: initialMessage,
    };

    await redisClient.setex(`auto_response:${instanceKey}:${chatId}`, AUTO_RESPONSE_EXPIRY, JSON.stringify(initialState));
    await executeFunnel(funnel, chatId, instanceKey, initialState);
};

exports.toggleAutoResponse = async (req, res) => {
    try {
      const { instanceKey, funnelId, isActive } = req.body;
      const user = await User.findById(req.user.id);
  
      if (!user) {
        return res.status(404).json({ error: 'Usuário não encontrado' });
      }
  
      const instance = user.whatsappInstances.find(inst => inst.key === instanceKey);
      if (!instance) {
        return res.status(404).json({ error: 'Instância não encontrada' });
      }
  
      // Verifica se o funnelId é válido
      if (isActive && !mongoose.Types.ObjectId.isValid(funnelId)) {
        return res.status(400).json({ error: 'ID do funil inválido' });
      }
  
      instance.autoResponse = {
        isActive,
        funnelId: isActive ? new mongoose.Types.ObjectId(funnelId) : null
      };
  
      await user.save();
  
      res.json({ success: true, message: 'Configuração de autoresposta atualizada' });
    } catch (error) {
      console.error('Erro ao configurar autoresposta:', error);
      res.status(500).json({ error: 'Erro ao configurar autoresposta' });
    }
  };