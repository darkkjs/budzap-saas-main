// controllers/massMessageController.js

const User = require('../models/User');
const MassMessageReport = require('../models/MassMessageReport');
const { handleAutoResponse } = require('../controllers/autoResponseController');
const redisClient = require('../config/redisConfig');
const { v4: uuidv4 } = require('uuid');

let activeJobs = new Map();

const PLAN_LIMITS = {
    gratuito: 0,
    basico: 500,
    plus: 1000,
    premium: Infinity
};

exports.renderMassMessagePage = async (req, res) => {
    try {
        const userId = req.user.id;
        const funnelsKey = `user:${userId}:funnels`;
        const funnelIds = await redisClient.smembers(funnelsKey);

        const funnels = await Promise.all(funnelIds.map(async (funnelId) => {
            const funnelData = await redisClient.get(`funnel:${funnelId}`);
            return JSON.parse(funnelData);
        }));

        console.log('Funis carregados:', funnels);

        const user = await User.findById(userId).populate('whatsappInstances');
        
        if (!user) {
            return res.status(404).render('error', { message: 'Usuário não encontrado' });
        }

        res.render('mass-message', { 
            user: req.user,
            funnels: funnels,
            instances: user.whatsappInstances.filter(instance => instance.isConnected)
        });
    } catch (error) {
        console.error('Erro ao carregar página de mensagem em massa:', error);
        res.status(500).render('error', { message: 'Erro ao carregar página' });
    }
};

exports.startMassMessage = async (req, res) => {
    const { numbers, funnelName, instanceIds, alternateInstances } = req.body;
    const userId = req.user.id;

    try {
        let numberList = Array.isArray(numbers) ? numbers : numbers.split('\n');
        numberList = numberList.map(num => num.toString().trim()).filter(num => num);

        if (numberList.length === 0) {
            return res.status(400).json({ error: 'Nenhum número válido fornecido' });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }

        const remainingLimit = user.funnelLimit - user.funnelUsage;
        if (numberList.length > remainingLimit) {
            return res.status(400).json({ error: `Limite excedido. Você pode enviar mais ${remainingLimit} mensagens.` });
        }

        const selectedFunnel = await getFunnelFromRedis(funnelName, userId);
        if (!selectedFunnel) {
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
            funnelName: selectedFunnel.name,
            totalNumbers: numberList.length,
            startTime: new Date()
        });
        await report.save();

        const jobId = uuidv4();
        const job = {
            id: jobId,
            numbers: numberList,
            funnel: selectedFunnel,
            instances: selectedInstances,
            currentIndex: 0,
            report: report,
            isStopped: false,
            alternateInstances: alternateInstances
        };
        activeJobs.set(jobId, job);

        // Inicie o processamento do job de forma assíncrona
        processJob(job, userId);

        res.json({ reportId: report._id.toString(), jobId: jobId, totalNumbers: numberList.length });
    } catch (error) {
        console.error('Erro ao iniciar envio em massa:', error);
        res.status(500).json({ error: 'Erro ao iniciar envio em massa' });
    }
};

async function processJob(job, userId) {
    const { numbers, funnel, instances } = job;
    let currentInstanceIndex = 0;
    const user = await User.findById(userId);

    for (let i = job.currentIndex; i < numbers.length && !job.isStopped; i++) {
        if (job.isStopped) break;

        const instance = job.alternateInstances
            ? instances[currentInstanceIndex % instances.length]
            : instances[0];
        
        try {
            user.funnelUsage += 1;
            await user.save();

            console.log(`Usando instância ${instance.name} para enviar para ${numbers[i]}`);
            
            // Inicia a autoresposta para este número
            await handleAutoResponse(instance.key, numbers[i] + "@s.whatsapp.net", '');

            job.report.sent += 1;
            console.log(`Autoresposta iniciada para ${numbers[i]} usando instância ${instance.name}`);
        } catch (error) {
            console.error(`Erro ao iniciar autoresposta para ${numbers[i]} usando instância ${instance.name}:`, error);
            job.report.errors += 1;
        }

        job.currentIndex = i + 1;
        if (job.alternateInstances) {
            currentInstanceIndex++;
        }
        await job.report.save();

        if ((i + 1) % 10 === 0 || i === numbers.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        if (job.isStopped) break;
    }

    if (job.currentIndex >= numbers.length || job.isStopped) {
        job.report.endTime = new Date();
        job.report.isCompleted = true;
        await job.report.save();
        activeJobs.delete(job.id);
    }
}

async function getFunnelFromRedis(funnelName, userId) {
    const funnelsKey = `user:${userId}:funnels`;
    const funnelIds = await redisClient.smembers(funnelsKey);

    for (const funnelId of funnelIds) {
        const funnelData = await redisClient.get(`funnel:${funnelId}`);
        const funnel = JSON.parse(funnelData);
        if (funnel.name === funnelName) {
            return funnel;
        }
    }
    return null;
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
    const { jobId } = req.body;
    console.log('Tentando interromper job com jobId:', jobId);
    console.log('Jobs ativos:', Array.from(activeJobs.keys()));

    try {
        const job = activeJobs.get(jobId);
        if (job) {
            job.isStopped = true;
            const report = job.report;
            if (report) {
                report.isCompleted = true;
                report.endTime = new Date();
                await report.save();
                console.log('Job interrompido com sucesso:', jobId);
                res.json({ 
                    message: 'Envio em massa interrompido com sucesso',
                    sent: report.sent,
                    errors: report.errors,
                    total: report.totalNumbers
                });
            } else {
                console.log('Relatório não encontrado para o jobId:', jobId);
                res.status(404).json({ error: 'Relatório não encontrado' });
            }
            activeJobs.delete(jobId);
        } else {
            console.log('Job não encontrado para o jobId:', jobId);
            res.status(404).json({ error: 'Job não encontrado' });
        }
    } catch (error) {
        console.error('Erro ao interromper envio em massa:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
};

module.exports = {
    renderMassMessagePage: exports.renderMassMessagePage,
    startMassMessage: exports.startMassMessage,
    getProgress: exports.getProgress,
    stopMassMessage: exports.stopMassMessage
};