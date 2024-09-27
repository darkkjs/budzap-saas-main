const WhatsappCampaign = require('../models/WhatsappCampaign');

exports.getStats = async (req, res) => {
  try {
    const campaign = await WhatsappCampaign.findOne({ _id: req.params.id, user: req.user._id });
    if (!campaign) return res.status(404).json({ message: 'Campanha não encontrada' });
    res.json(campaign.stats);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateStats = async (req, res) => {
  try {
    const { type } = req.body;
    const campaign = await WhatsappCampaign.findOne({ _id: req.params.id, user: req.user._id });
    if (!campaign) return res.status(404).json({ message: 'Campanha não encontrada' });

    if (type === 'conversion') {
      campaign.stats.conversions += 1;
    } else if (type === 'block') {
      campaign.stats.blocks += 1;
    }

    await campaign.save();
    res.json(campaign.stats);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};