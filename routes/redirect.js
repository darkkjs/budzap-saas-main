// routes/redirect.js
const express = require('express');
const router = express.Router();
const WhatsappCampaign = require('../models/WhatsappCampaign');

router.get('/:customPath', async (req, res) => {
  try {
    const campaign = await WhatsappCampaign.findOne({ customPath: req.params.customPath });
    if (!campaign) return res.status(404).send('Campanha não encontrada');

    // Incrementar o contador de cliques
    campaign.stats.clicks += 1;
    await campaign.save();

    let selectedNumber;
    if (campaign.redirectType === 'single' || campaign.numbers.length === 1) {
      selectedNumber = campaign.numbers[0];
    } else if (campaign.redirectType === 'multiple') {
      // Garantir que a randomização funcione corretamente
      selectedNumber = campaign.numbers[Math.floor(Math.random() * campaign.numbers.length)];
    } else if (campaign.redirectType === 'rotative') {
      selectedNumber = campaign.numbers[campaign.lastUsedIndex];
      campaign.lastUsedIndex = (campaign.lastUsedIndex + 1) % campaign.numbers.length;
      await campaign.save();
    }

    console.log('Número selecionado:', selectedNumber); // Log para depuração

    let whatsappUrl = `https://wa.me/${selectedNumber}`;
    if (campaign.customMessage) {
      whatsappUrl += `?text=${encodeURIComponent(campaign.customMessage)}`;
    }

    // Se a campanha tem meta tags, renderize uma página HTML com as tags antes de redirecionar
    if (campaign.metaTags) {
      const html = `
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${campaign.metaTags.title}</title>
          <meta property="og:title" content="${campaign.metaTags.title}">
          <meta property="og:description" content="${campaign.metaTags.description}">
          <meta property="og:image" content="${campaign.metaTags.image}">
          <meta property="og:url" content="${req.protocol}://${req.get('host')}${req.originalUrl}">
          <meta http-equiv="refresh" content="${campaign.messageDelay};url=${whatsappUrl}">
          <script>
            setTimeout(() => {
              window.location.href = "${whatsappUrl}";
            }, ${campaign.messageDelay * 1000});
          </script>
        </head>
        <body>
          <p>Redirecionando para WhatsApp em ${campaign.messageDelay} segundos...</p>
        </body>
        </html>
      `;
      return res.send(html);
    }

    // Se não há meta tags, apenas redirecione após o delay
    setTimeout(() => {
      res.redirect(whatsappUrl);
    }, campaign.messageDelay * 1000);

  } catch (error) {
    console.error('Erro ao redirecionar:', error);
    res.status(500).send('Erro ao redirecionar');
  }
});

module.exports = router;