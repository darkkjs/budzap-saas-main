const express = require('express');
const router = express.Router();
const integrationController = require('../controllers/integrationController');
const { ensureAuthenticated } = require('../middleware/auth');
const github = require('../config/git');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' }); // Esta pasta deve existir~
const fs = require("fs")
const { v4: uuidv4 } = require('uuid');
const axios = require("axios")
router.get('/elevenlabs', ensureAuthenticated, (req, res) => {
    res.render('elevenlabs-integration', {user: req.user});
});


// Add this new route
router.get('/elevenlabs/check-config', ensureAuthenticated, integrationController.checkElevenLabsConfig);

router.get('/mercadopago-app/status', ensureAuthenticated, integrationController.getMercadoPagoAppStatus);
router.post('/mercadopago-app/configure', ensureAuthenticated, integrationController.configureMercadoPagoApp);
router.get('/mercadopago-app/test', ensureAuthenticated, integrationController.testMercadoPagoApp);


const PLAN_LIMITS = require('../config/planLimits');

// ... (manter as funções existentes)

// Função auxiliar para verificar se o usuário tem acesso a uma feature
function checkFeatureAccess(userPlan, feature) {
    return PLAN_LIMITS[userPlan][feature];
}


// Rota para o dashboard de integrações
router.get('/dashboard', ensureAuthenticated, (req, res) => {
    res.render('integracoes', { 
        user: req.user,
        pageTitle: 'Dashboard de Integrações',
        checkFeatureAccess
    });
});

// Rota para o dashboard de integrações
router.get('/hospedar', ensureAuthenticated, (req, res) => {
    res.render('hospedar', { 
        user: req.user,
        pageTitle: 'Hospedagem de midia'
    });
});

const uploadMediaToGithub = async (file, type, github) => {
    let base64File;
    let mediaUrl;
  
    try {
      base64File = fs.readFileSync(file.path, { encoding: 'base64' });
  
      const filename = await uuidv4();
      let nomearqv;
      if(type == "image") {
        nomearqv = filename + ".jpg"
      } else if(type == "audio") {
        nomearqv = filename + ".mp3"
      } else if(type == "video") {
        nomearqv = filename + ".mp4"
      }
  
      const response = await axios.put(
        `https://api.github.com/repos/${github.GITHUB_USERNAME}/${github.GITHUB_REPO}/contents/${nomearqv}`,
        {
          message: `Upload de ${type} via API`,
          content: base64File
        },
        {
          headers: {
            'Authorization': `token ${github.GITHUB_TOKEN}`,
            'Content-Type': 'application/json'
          }
        }
      );
  
      mediaUrl = response.data.content.download_url;
      console.log(`${type} hospedado com sucesso no GitHub:`, mediaUrl);
    } catch (error) {
      console.error(`Erro ao hospedar o arquivo no GitHub:`, error);
    } finally {
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
    }
  
    return mediaUrl;
  };

  const minioClient = require('../config/minioConfig');

  
  const { Readable } = require('stream');
  const crypto = require('crypto');
  
  const fs2 = require('fs').promises;
 const path = require("path")
  
  router.post('/upload-media', upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Nenhum arquivo enviado' });
      }
  
      const file = req.file;
      const type = file.mimetype.startsWith('image/') ? 'image' :
                   file.mimetype.startsWith('video/') ? 'video' :
                   file.mimetype.startsWith('audio/') || file.mimetype === 'application/ogg' ? 'audio' : null;
  
      if (!type) {
        return res.status(400).json({ error: 'Tipo de arquivo não suportado' });
      }
  
      // Lê o arquivo do disco
      const fileBuffer = await fs2.readFile(file.path);
  
      const bucketName = 'chat-media';
      const fileHash = crypto.createHash('md5').update(fileBuffer).digest('hex');
      const fileExtension = path.extname(file.originalname).slice(1);
      const objectName = `${type}/${fileHash}.${fileExtension}`;
  
      // ... (resto do código permanece o mesmo)
  
      // Cria um stream legível a partir do buffer do arquivo
      const fileStream = new Readable();
      fileStream.push(fileBuffer);
      fileStream.push(null);
  
      // Upload do arquivo para o MinIO
      await minioClient.putObject(bucketName, objectName, fileStream, fileBuffer.length, {
        'Content-Type': file.mimetype
      });
  
      // Constrói a URL permanente
      const mediaUrl = `https://hocketzap.com/integrations/media/${objectName}`;
  
      // Remove o arquivo temporário
      await fs2.unlink(file.path);
  
      res.json({ 
        url: mediaUrl,
        type: type
      });
  
    } catch (error) {
      console.error('Erro no upload:', error);
      res.status(500).json({ error: 'Falha no upload do arquivo' });
    }
  });
  
  // Nova rota para servir os arquivos de mídia
  router.get('/media/:type/:filename', async (req, res) => {
    const bucketName = 'chat-media';
    const objectName = `${req.params.type}/${req.params.filename}`;
  
    try {
      const stream = await minioClient.getObject(bucketName, objectName);
      stream.pipe(res);
    } catch (error) {
      console.error('Error serving media:', error);
      res.status(404).send('Media not found');
    }
  });

router.get('/elevenlabs/config', ensureAuthenticated, integrationController.getElevenLabsConfig);


router.post('/elevenlabs/save', ensureAuthenticated, integrationController.saveElevenLabsConfig);
router.post('/elevenlabs/test', ensureAuthenticated, integrationController.testElevenLabsIntegration);

// Rotas Mercado Pago
router.get('/mercadopago', ensureAuthenticated, integrationController.getMercadoPagoConfig);

router.post('/mercadopago/save', ensureAuthenticated, integrationController.saveMercadoPagoConfig);
router.get('/mercadopago/test', ensureAuthenticated, integrationController.testMercadoPagoIntegration);
// Nova rota GET para buscar a configuração do Mercado Pago
router.get('/mercadopago/config', ensureAuthenticated, integrationController.getMercadoPagoConfig);


module.exports = router;