// controllers/massMessageController.js

const User = require('../models/User');

const MassMessageReport = require('../models/MassMessageReport');
const { executeFunnel } = require('../services/funnelExecutor');
const { getActiveFunnels } = require('../utils/funnelHelper');
const { AUTO_RESPONSE_LIMITS } = require('../config/planLimits');

let activeJobs = new Map();


const PLAN_LIMITS = {
    gratuito: 0,
    basico: 500,
    plus: 1000,
    premium: Infinity
};


exports.renderMassMessagePage = async (req, res) => {
    try {
        const activeFunnels = getActiveFunnels(req.user);
        // Buscar o usuário novamente para garantir dados atualizados
        const user = await User.findById(req.user.id).populate('whatsappInstances').populate('funnels');
        
        if (!user) {
            return res.status(404).render('error', { message: 'Usuário não encontrado' });
        }

        res.render('mass-message', { 
            user: req.user,
      funnels: activeFunnels,
            instances: user.whatsappInstances.filter(instance => instance.isConnected)
        });
    } catch (error) {
        console.error('Erro ao carregar página de mensagem em massa:', error);
        res.status(500).render('error', { message: 'Erro ao carregar página' });
    }
};

exports.startMassMessage = async (req, res) => {
    const { numbers, funnelId, instanceIds, alternateInstances  } = req.body;
    const userId = req.user.id;

    try {
        let numberList;
        if (Array.isArray(numbers)) {
            numberList = numbers.map(num => num.toString().trim()).filter(num => num);
        } else if (typeof numbers === 'string') {
            numberList = numbers.split('\n').map(num => num.trim()).filter(num => num);
        } else {
            return res.status(400).json({ error: 'Formato de números inválido' });
        }

        if (numberList.length === 0) {
            return res.status(400).json({ error: 'Nenhum número válido fornecido' });
        }

        // Buscar o usuário e atualizar o funnelUsage
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }

        // Verificar se o usuário tem limite disponível
        const remainingLimit = user.funnelLimit - user.funnelUsage;
        if (numberList.length > remainingLimit) {
            return res.status(400).json({ error: `Limite excedido. Você pode enviar mais ${remainingLimit} mensagens.` });
        }

        // Atualizar o funnelUsage
       
        
        const funnel = user.funnels.id(funnelId);
        if (!funnel) {
            return res.status(404).json({ error: 'Funil não encontrado' });
        }
        
        const selectedInstances = user.whatsappInstances.filter(
            instance => instanceIds.includes(instance._id.toString())
        );

        if (selectedInstances.length === 0) {
            return res.status(400).json({ error: 'Nenhuma instância válida selecionada' });
        }


        const report = new MassMessageReport({
            user: userId,
            funnel: funnelId,
            totalNumbers: numberList.length,
            startTime: new Date()
        });
        await report.save();

        const job = {
            numbers: numberList,
            funnel,
            instances: selectedInstances,
            currentIndex: 0,
            report: report,
            isStopped: false,
            alternateInstances: alternateInstances // Adicione esta linha
        };
        activeJobs.set(report._id.toString(), job);
        console.log('Novo job criado com reportId:', report._id.toString()); // Log para debug

        // Inicie o processamento do job de forma assíncrona
        processJob(job, userId);

        res.json({ reportId: report._id.toString(), totalNumbers: numberList.length });
    } catch (error) {
        console.error('Erro ao iniciar envio em massa:', error);
        res.status(500).json({ error: 'Erro ao iniciar envio em massa' });
    }
};

async function processJob(job, userId) {
    const { numbers, funnel, instances, report } = job;
    let currentInstanceIndex = 0;
    const user = await User.findById(userId);

    for (let i = job.currentIndex; i < numbers.length && !job.isStopped; i++) {
        if (job.isStopped) break;

        const instance = job.alternateInstances
            ? instances[currentInstanceIndex % instances.length]
            : instances[0];
        
        try {
            user.funnelUsage += 1
            await user.save();

            console.log(`Usando instância ${instance.name} para enviar para ${numbers[i]}`);
            
            // Criar um estado inicial para cada número
            const initialState = {
                currentStep: 0,
                userInputs: {},
                status: 'active'
            };
            
            await executeFunnel(funnel, numbers[i], instance.key, initialState);
            report.sent += 1;
            console.log(`Mensagem enviada para ${numbers[i]} usando instância ${instance.name}`);
        } catch (error) {
            console.error(`Erro ao enviar mensagem para ${numbers[i]} usando instância ${instance.name}:`, error);
            report.errors += 1;
        }

        job.currentIndex = i + 1;
        if (job.alternateInstances) {
            currentInstanceIndex++;
        }
        await report.save();

        if ((i + 1) % 10 === 0 || i === numbers.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000)); // Pausa a cada 10 envios
        }

        if (job.isStopped) break; // Verificação adicional
    }

    if (job.currentIndex >= numbers.length || job.isStopped) {
        report.endTime = new Date();
        report.isCompleted = true;
        await report.save();
        activeJobs.delete(report._id.toString());
    }
}


exports.getProgress = async (req, res) => {
    const { reportId } = req.query;
    try {
        const report = await MassMessageReport.findById(reportId);
        if (!report) {
            return res.status(404).json({ error: 'Relatório não encontrado' });
        }
        res.json({
            sent: report.sent,
            errors: report.errors,
            total: report.totalNumbers,
            isCompleted: report.isCompleted
        });
    } catch (error) {
        console.error('Erro ao obter progresso:', error);
        res.status(500).json({ error: 'Erro ao obter progresso' });
    }
};

exports.stopMassMessage = async (req, res) => {
    const { reportId } = req.body;
    console.log('Tentando interromper job com reportId:', reportId);
    console.log('Jobs ativos:', Array.from(activeJobs.keys()));

    try {
        const job = activeJobs.get(reportId);
        if (job) {
            job.isStopped = true;
            const report = await MassMessageReport.findById(reportId);
            if (report) {
                report.isCompleted = true;
                report.endTime = new Date();
                await report.save();
                console.log('Job interrompido com sucesso:', reportId);
                res.json({ 
                    message: 'Envio em massa interrompido com sucesso',
                    sent: report.sent,
                    errors: report.errors,
                    total: report.totalNumbers
                });
            } else {
                console.log('Relatório não encontrado para o reportId:', reportId);
                res.status(404).json({ error: 'Relatório não encontrado' });
            }
            activeJobs.delete(reportId);
        } else {
            console.log('Job não encontrado para o reportId:', reportId);
            res.status(404).json({ error: 'Job não encontrado' });
        }
    } catch (error) {
        console.error('Erro ao interromper envio em massa:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
};