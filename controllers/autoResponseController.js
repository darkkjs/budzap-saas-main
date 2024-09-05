// controllers/autoResponseController.js

const User = require('../models/User');
const { executeFunnel, sendTextMessage } = require('../services/funnelExecutor');
const mongoose = require('mongoose');
const colors = require('colors');
const Chat = require('../models/Chat');
const redisClient = require('../config/redisConfig');
const AUTO_RESPONSE_EXPIRY = 60 * 60; // 1 hora em segundos
const { AUTO_RESPONSE_LIMITS } = require('../config/planLimits');

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

const MAX_RETRIES = 5;
const RETRY_DELAY = 100; // milliseconds

/*/
exports.handleIncomingMessage = async (message, instanceKey) => {
  let retries = 0;
  while (retries < MAX_RETRIES) {
      const session = await mongoose.startSession();
      try {
          session.startTransaction();

          const user = await User.findOne({ 'whatsappInstances.key': instanceKey }).session(session);

          if (!user) {
              console.log('Usuário ou instância não encontrada'.red);
              throw new Error('Usuário ou instância não encontrada');
          }

          const instance = user.whatsappInstances.find(inst => inst.key === instanceKey);
          if (!instance || !instance.autoResponse || !instance.autoResponse.isActive) {
              console.log('Autoresposta não está ativa para esta instância'.yellow);
              await session.abortTransaction();
              return;
          }

          let chat = await Chat.findOne({ chatId: message.id, instanceKey }).session(session);
          if (!chat) {
              chat = new Chat({
                  chatId: message.id,
                  instanceKey,
                  name: message.pushName,
                  image: message.imagemPerfil,
                  lastMessage: message.content,
                  autoResponseSent: false,
                  currentStep: 0,
                  userInputs: {},
                  lastProcessedTimestamp: 0
              });
              await chat.save({ session });
              console.log(`Novo chat criado para ${message.id}`.blue);
          }

          if (message.messageTimestamp <= chat.lastProcessedTimestamp) {
              console.log(`Mensagem já processada para ${message.id}. Ignorando.`.yellow);
              await session.abortTransaction();
              return;
          }

          chat.lastProcessedTimestamp = message.messageTimestamp;
          chat.lastMessage = message.content;

          // Fetch the actual funnel object
          const funnel = user.funnels.id(instance.autoResponse.funnelId);
          if (!funnel) {
              console.error(`Funil não encontrado para a autoresposta. ID: ${instance.autoResponse.funnelId}`.red);
              await session.abortTransaction();
              return;
          }

          if (!chat.autoResponseSent || chat.currentStep < funnel.steps.length) {
              console.log(`Executando funil para ${message.id}`.cyan);
              console.log('Funnel steps:'.green, JSON.stringify(funnel.steps, null, 2));
              
              await executeFunnel(funnel, message.id, instanceKey, chat, session);
              
              chat.autoResponseSent = true;

              if (!instance.autoResponseReports) {
                  instance.autoResponseReports = [];
              }
              instance.autoResponseReports.push({
                  chatId: message.id,
                  funnelId: funnel._id,
                  timestamp: new Date()
              });

              user.autoResponseCount += 1;
          } else {
              console.log(`Autoresposta já concluída para ${message.id}. Ignorando.`.yellow);
          }

          await chat.save({ session });
          await user.save({ session });
          await session.commitTransaction();
          console.log(`Autoresposta processada com sucesso para ${message.id}`.green);
          return; // Success, exit the retry loop
      } catch (error) {
          await session.abortTransaction();
          if (error.code === 112 && error.codeName === 'WriteConflict') {
              retries++;
              console.log(`Retry attempt ${retries} due to write conflict`.yellow);
              await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
          } else {
              console.log('Erro ao processar mensagem de autoresposta:'.red, error);
              throw error; // Rethrow non-WriteConflict errors
          }
      } finally {
          session.endSession();
      }
  }
  console.log(`Failed to process message after ${MAX_RETRIES} retries`.red);
};
/*/


exports.updateCampaigns = async (req, res) => {
  try {
      const { instanceKey, campaigns } = req.body;
      const campaignsKey = `auto_response_campaigns:${instanceKey}`;

      await redisClient.set(campaignsKey, JSON.stringify(campaigns));

      res.json({ success: true, message: 'Campanhas de autoresposta atualizadas com sucesso' });
  } catch (error) {
      console.error('Erro ao atualizar campanhas:', error);
      res.status(500).json({ error: 'Erro ao atualizar campanhas de autoresposta' });
  }
};

exports.getCampaigns = async (req, res) => {
  try {
      const { instanceKey } = req.params;
      const campaignsKey = `auto_response_campaigns:${instanceKey}`;

      const campaignsData = await redisClient.get(campaignsKey);
      const campaigns = campaignsData ? JSON.parse(campaignsData) : [];

      res.json({ success: true, campaigns });
  } catch (error) {
      console.error('Erro ao buscar campanhas:', error);
      res.status(500).json({ error: 'Erro ao buscar campanhas de autoresposta' });
  }
};

exports.handleAutoResponse = async (instanceKey, chatId, message) => {
  try {
      console.log('Processando autoresposta para:'.cyan, { instanceKey, chatId, message });
      
         // Verificar se há um funil em andamento
         const autoResponseKey = `auto_response:${instanceKey}:${chatId}`;
         const currentState = await redisClient.get(autoResponseKey);
 
         if (currentState) {
             // Há um funil em andamento, processar como input do usuário
             console.log('Funil em andamento encontrado, processando input do usuário'.yellow);
             const state = JSON.parse(currentState);
             await processUserInput(instanceKey, chatId, message, state);
             return;
         }
 

         const campaignsKey = `auto_response_campaigns:${instanceKey}`;
         const campaignsData = await redisClient.get(campaignsKey);
         const campaigns = campaignsData ? JSON.parse(campaignsData) : [];
 

      for (const campaign of campaigns) {
          if (!campaign.isActive) continue;

          let shouldExecute = false;
          switch (campaign.condition) {
              case 'all':
                  shouldExecute = true;
                  break;
              case 'startsWith':
                  shouldExecute = message.toLowerCase().startsWith(campaign.value.toLowerCase());
                  break;
              case 'contains':
                  shouldExecute = message.toLowerCase().includes(campaign.value.toLowerCase());
                  break;
                  case 'equals':
                    shouldExecute = message.toLowerCase() === campaign.value.toLowerCase();
                    break;
                case 'regex':
                    shouldExecute = new RegExp(campaign.value, 'i').test(message);
                    break;
            }

            if (shouldExecute) {
              console.log(`Executando campanha: ${campaign.name}`.green);
                
              await recordCampaignActivation(instanceKey, campaign.name, chatId);
              await executeCampaign(instanceKey, chatId, message, campaign);
              
              return; // Sai após executar a primeira campanha correspondente
            }
        }

        console.log('Nenhuma campanha correspondente encontrada'.red);
    } catch (error) {
        console.error('Erro ao processar autoresposta:'.red, error);
    }
};


async function recordCampaignActivation(instanceKey, campaignName, chatId) {
  const activationsKey = `campaign_activations:${instanceKey}:${campaignName}`;
  const reportsKey = `auto_response_reports:${instanceKey}`;
  const userUsageKey = `user_auto_response_usage:${instanceKey}`;

  try {
      // Incrementar contador de ativações da campanha
      await redisClient.incr(activationsKey);

      // Incrementar contador de uso do usuário
      await redisClient.incr(userUsageKey);

      // Adicionar relatório
      const report = JSON.stringify({
          campaignName,
          chatId,
          timestamp: new Date().toISOString()
      });
      await redisClient.lpush(reportsKey, report);
      await redisClient.ltrim(reportsKey, 0, 99); // Manter apenas os 100 relatórios mais recentes

           // Incrementar contador no modelo de usuário
           const user = await User.findOne({ 'whatsappInstances.key': instanceKey });
           if (user) {
               user.autoResponseCount += 1;
               await user.save();
           }
   
           console.log(`Ativação de campanha registrada: ${campaignName}`.green);
           console.log(`Uso de autoresposta incrementado para a instância: ${instanceKey}`.green);
           
  } catch (error) {
      console.error('Erro ao registrar ativação de campanha:', error);
  }
}

// Atualizar a função getAutoResponseReport para incluir o uso total
exports.getAutoResponseReport = async (req, res) => {
  try {
      const { instanceKey } = req.params;
      const reportsKey = `auto_response_reports:${instanceKey}`;
      const campaignsKey = `auto_response_campaigns:${instanceKey}`;
      const userUsageKey = `user_auto_response_usage:${instanceKey}`;

      const [reportsData, campaignsData, totalUsage] = await Promise.all([
          redisClient.lrange(reportsKey, 0, 9),  // Pegar os 10 relatórios mais recentes
          redisClient.get(campaignsKey),
          redisClient.get(userUsageKey)
      ]);

      const recentResponses = reportsData.map(report => {
          const { campaignName, chatId, timestamp } = JSON.parse(report);
          return {
              campaignName,
              phoneNumber: chatId.split('@')[0],
              timestamp
          };
      });

      const campaigns = JSON.parse(campaignsData || '[]');
      const campaignActivations = {};

      await Promise.all(campaigns.map(async (campaign) => {
          const activationsKey = `campaign_activations:${instanceKey}:${campaign.name}`;
          const count = await redisClient.get(activationsKey);
          campaignActivations[campaign.name] = parseInt(count || '0');
      }));

      res.json({
          success: true,
          totalResponses: parseInt(totalUsage || '0'),
          recentResponses,
          campaignActivations
      });
  } catch (error) {
      console.error('Erro ao gerar relatório:', error);
      res.status(500).json({ success: false, error: 'Erro ao gerar relatório' });
  }
};

// Adicionar uma nova função para obter o uso de autoresposta
exports.getAutoResponseUsage = async (req, res) => {
  try {
     
      
      const user = await User.findOne({ username: req.user.username });

      if (!user) {
        return res.status(404).json({ success: false, error: 'Usuário não encontrado' });
    }

    const isPremium = user.plan === 'premium';

    res.json({
        success: true,
        usage: user.autoResponseCount,
        limit: isPremium ? Infinity : user.autoResponseLimit,
        isPremium
    });
  } catch (error) {
      console.error('Erro ao obter uso de autoresposta:', error);
      res.status(500).json({ success: false, error: 'Erro ao obter uso de autoresposta' });
  }
};




async function executeCampaign(instanceKey, chatId, message, campaign) {
  const user = await User.findOne({ 'whatsappInstances.key': instanceKey });
  if (!user) {
      console.error('Usuário não encontrado para a instância:'.red, instanceKey);
      return;
  }

  const funnel = user.funnels.id(campaign.funnelId);
  if (!funnel) {
      console.error('Funil não encontrado:'.red, campaign.funnelId);
      return;
  }

  console.log(`Iniciando execução do funil: ${funnel.name}`.green);

  const initialState = {
      funnelId: funnel._id.toString(),
      currentStep: 0,
      status: 'in_progress',
      userInputs: {},
      lastMessage: message
  };

  await redisClient.setex(
      `auto_response:${instanceKey}:${chatId}`,
      AUTO_RESPONSE_EXPIRY,
      JSON.stringify(initialState)
  );

  await executeFunnel(funnel, chatId, instanceKey, initialState);
}


async function startNewAutoResponse(instanceKey, chatId, initialMessage) {
  console.log('Iniciando nova autoresposta:'.cyan, { instanceKey, chatId, initialMessage });

  const user = await User.findOne({ 'whatsappInstances.key': instanceKey });
  if (!user) {
      console.error('Usuário não encontrado para a instância:'.red, instanceKey);
      return;
  }

  const instance = user.whatsappInstances.find(inst => inst.key === instanceKey);
  if (!instance || !instance.autoResponse || !instance.autoResponse.isActive) {
      console.log('Autoresposta não está ativa para esta instância'.yellow);
      return;
  }

  const funnel = user.funnels.id(instance.autoResponse.funnelId);
  if (!funnel) {
      console.error('Funil não encontrado:'.red, instance.autoResponse.funnelId);
      return;
  }

  const initialState = {
      funnelId: funnel._id.toString(),
      currentStep: 0,
      status: 'in_progress',
      userInputs: {},
      lastMessage: initialMessage
  };

  console.log('Estado inicial da autoresposta:'.green, JSON.stringify(initialState, null, 2));

  await redisClient.setex(
      `auto_response:${instanceKey}:${chatId}`,
      AUTO_RESPONSE_EXPIRY,
      JSON.stringify(initialState)
  );

  await executeFunnel(funnel, chatId, instanceKey, initialState);
}

async function processUserInput(instanceKey, chatId, message, state) {
  console.log('Processando input do usuário:'.cyan, { instanceKey, chatId, message, state });

  const user = await User.findOne({ 'whatsappInstances.key': instanceKey });
  if (!user) {
      console.error('Usuário não encontrado para a instância:'.red, instanceKey);
      return;
  }

  const funnel = user.funnels.id(state.funnelId);
  if (!funnel) {
      console.error('Funil não encontrado:'.red, state.funnelId);
      return;
  }

  console.log('Funnel encontrado:'.green, funnel.name);

  const currentStep = funnel.steps[state.currentStep];
  if (currentStep && currentStep.type === 'input') {
      console.log('Processando passo de input:'.cyan, currentStep);

      state.userInputs[currentStep.inputKey] = message;
      state.currentStep++;
      state.status = 'in_progress';
      state.lastMessage = message;

      console.log('Estado atualizado:'.yellow, JSON.stringify(state, null, 2));

      await redisClient.setex(
          `auto_response:${instanceKey}:${chatId}`,
          AUTO_RESPONSE_EXPIRY,
          JSON.stringify(state)
      );

      console.log('Continuando execução do funil'.green);
      await executeFunnel(funnel, chatId, instanceKey, state);
  } else {
      console.log('Funil concluído, finalizando autoresposta:'.yellow, currentStep);
      await redisClient.del(`auto_response:${instanceKey}:${chatId}`);
  }
}



