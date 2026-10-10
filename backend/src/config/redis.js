const { createClient } = require('redis');

let redisClient = null;

const createRedisConnection = async () => {
  try {
    if (redisClient && redisClient.isOpen) {
      return redisClient;
    }

    redisClient = createClient({
      url: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
      socket: { connectTimeout: 3000, reconnectStrategy: false },
      disableOfflineQueue: true,
    });

    redisClient.on('error', (err) => {
      console.error('❌ Redis error:', err.message);
    });

    redisClient.on('connect', () => {
      console.log('🟡 Redis connecting...');
    });

    redisClient.on('ready', () => {
      console.log('✅ Redis connected');
    });

    redisClient.on('end', () => {
      console.log('🔴 Redis disconnected');
    });

    await redisClient.connect();
    return redisClient;
  } catch (error) {
    console.error('❌ Redis connection failed:', error.message);
    if (redisClient?.isOpen) redisClient.destroy();
    redisClient = null;
    return null;
  }
};

const getRedisClient = () => redisClient;

module.exports = {
  createRedisConnection,
  getRedisClient,
};