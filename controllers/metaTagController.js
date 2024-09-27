// controllers/metaTagController.js
const axios = require('axios');
const WhatsappCampaign = require('../models/WhatsappCampaign');

exports.generateMetaTags = async (req, res) => {
  try {
    const { campaignId } = req.params;
    if (!campaignId || campaignId === 'undefined') {
        return res.status(400).json({ message: 'ID da campanha inválido' });
      }
  
    // Gerar dados fictícios usando a API Lorem Picsum para imagens e Faker API para texto
    const imageResponse = await axios.get('https://picsum.photos/200/300');
    const fakerResponse = await axios.get('https://fakerapi.it/api/v1/texts?_quantity=1&_characters=50');
    
    const imageUrl = imageResponse.request.res.responseUrl;
    const { title, content } = fakerResponse.data.data[0];
console.log()
    // Atualizar a campanha com as novas meta tags
    const updatedCampaign = await WhatsappCampaign.findByIdAndUpdate(
      campaignId,
      {
        metaTags: {
          title: title,
          description: content,
          image: imageUrl
        }
      },
      { new: true }
    );

    if (!updatedCampaign) {
      return res.status(404).json({ message: 'Campanha não encontrada' });
    }

    res.json({ message: 'Meta tags geradas com sucesso', metaTags: updatedCampaign.metaTags });
  } catch (error) {
    console.error('Erro ao gerar meta tags:', error);
    res.status(500).json({ message: 'Erro ao gerar meta tags' });
  }
};