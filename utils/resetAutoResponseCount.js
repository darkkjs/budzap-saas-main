// utils/resetAutoResponseCount.js
const User = require('../models/User');

async function resetAutoResponseCount() {
  await User.updateMany({}, { $set: { autoResponseCount: 0 } });
  console.log('Contadores de autoresposta resetados');
}

module.exports = { resetAutoResponseCount };