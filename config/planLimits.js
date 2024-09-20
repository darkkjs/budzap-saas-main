const PLAN_LIMITS = {
    gratuito: {
      whatsappConnections: 0,
      funnels: 0,
      dailySpamMessages: 0,
      dailyAutoResponses: 0,
      groupManagement: false,
      voiceGenerator: false,  // Alterado para true
      antiban: false,
      api: false,  // Alterado para true
      support: 'basic',
      analytics: false,
      elevenlabsIntegration: false,  // Nova integração
      mercadoPagoIntegration: false,  // Nova integração
    },
    basico: {
      whatsappConnections: 1,
        funnels: 15,
        dailySpamMessages: 1500,
        dailyAutoResponses: 750,
      groupManagement: 'basic',
      voiceGenerator: true,  // Alterado para true
      antiban: false,
      api: true,  // Alterado para true
      support: 'basic',
      analytics: false,
      elevenlabsIntegration: true,  // Nova integração
      mercadoPagoIntegration: true,  // Nova integração
    },
    plus: {
      whatsappConnections: 3,
      funnels: 50,
      dailySpamMessages: 15000,
      dailyAutoResponses: 2000,
      groupManagement: 'advanced',
      voiceGenerator: true,
      antiban: true,
      api: true,  // Alterado para true
      support: 'priority',
      analytics: 'basic',
      elevenlabsIntegration: true,  // Nova integração
      mercadoPagoIntegration: true,  // Nova integração
    },
    premium: {
      whatsappConnections: 10,
      funnels: Infinity,
      dailySpamMessages: Infinity,
      dailyAutoResponses: Infinity,
      groupManagement: 'advanced',
      voiceGenerator: true,
      antiban: true,
      api: true,  // Alterado para true
      support: '24/7',
      analytics: 'advanced',
      elevenlabsIntegration: true,  // Nova integração
      mercadoPagoIntegration: true,  // Nova integração
    }
  };
  
  module.exports = PLAN_LIMITS;