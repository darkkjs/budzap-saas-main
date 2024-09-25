// redisConfig.js
const Redis = require('ioredis');

const redisClient = new Redis({
  host: '147.79.111.143',
  port: 6379,
  password: 'darklindo',
});

module.exports = redisClient;