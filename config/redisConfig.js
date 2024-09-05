// redisConfig.js
const Redis = require('ioredis');

const redisClient = new Redis({
  host: '195.200.7.87',
  port: 6379,
  password: 'darkvips',
});

module.exports = redisClient;