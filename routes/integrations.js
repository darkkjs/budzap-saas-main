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
  
  router.post('/upload-media', upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Nenhum arquivo enviado' });
      }
  
      const file = req.file;
      const type = file.mimetype.startsWith('image/') ? 'image' :
                   file.mimetype.startsWith('video/') ? 'video' :
                   file.mimetype.startsWith('audio/') ? 'audio' : null;
      
      if (!type) {
        return res.status(400).json({ error: 'Tipo de arquivo não suportado' });
      }
  
      const bucketName = 'chat-media'; // Nome do seu bucket no MinIO
      const objectName = `${Date.now()}-${file.originalname}`; // Nome único para o objeto
  
      // Verifica se o bucket existe, se não, cria
      const bucketExists = await minioClient.bucketExists(bucketName);
      if (!bucketExists) {
        await minioClient.makeBucket(bucketName);
      }
  
      // Configura a política de acesso público para o bucket
      const policy = {
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: '*',
            Action: ['s3:GetObject'],
            Resource: [`arn:aws:s3:::${bucketName}/*`]
          }
        ]
      };
      await minioClient.setBucketPolicy(bucketName, JSON.stringify(policy));
  
      // Cria um stream legível a partir do buffer do arquivo
      const fileStream = new Readable();
      fileStream.push(file.buffer);
      fileStream.push(null);
  
      // Upload do arquivo para o MinIO
      await minioClient.putObject(bucketName, objectName, fileStream, file.size);
  
      // Constrói a URL permanente
      const mediaUrl = `http://147.79.111.143:9000/${bucketName}/${objectName}`;
  
      res.json({ url: mediaUrl });
    } catch (error) {
      console.error('Erro no upload:', error);
      res.status(500).json({ error: 'Falha no upload do arquivo' });
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