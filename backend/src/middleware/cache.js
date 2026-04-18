const crypto = require('crypto');
const { getRedisClient } = require('../config/redis');

const defaultCacheKey = (prefix, req) => {
  const rawKey = `${req.method}:${req.originalUrl || req.url}`;
  const hash = crypto.createHash('md5').update(rawKey).digest('hex');
  return `instahr:${prefix}:${hash}`;
};

const cacheResponse = ({ prefix = 'default', ttl = 300, keyBuilder = null } = {}) => {
  return async (req, res, next) => {
    try {
      if (req.method !== 'GET') return next();

      const redis = getRedisClient();
      if (!redis || !redis.isOpen) return next();

      const key = keyBuilder
        ? keyBuilder(req)
        : defaultCacheKey(prefix, req);

      const cached = await redis.get(key);

      if (cached) {
        res.set('X-Cache', 'HIT');
        return res.status(200).json(JSON.parse(cached));
      }

      const originalJson = res.json.bind(res);

      res.json = async (body) => {
        try {
          if (res.statusCode === 200) {
            await redis.set(key, JSON.stringify(body), {
              EX: ttl,
            });
            res.set('X-Cache', 'MISS');
          }
        } catch (error) {
          console.error('Redis set cache error:', error.message);
        }

        return originalJson(body);
      };

      next();
    } catch (error) {
      console.error('Redis cache middleware error:', error.message);
      next();
    }
  };
};

const clearCacheByPattern = async (pattern) => {
  try {
    const redis = getRedisClient();
    if (!redis || !redis.isOpen) return 0;

    const keys = [];

    for await (const item of redis.scanIterator({
      MATCH: pattern,
      COUNT: 100,
    })) {
      const key =
        typeof item === 'string' || Buffer.isBuffer(item)
          ? item
          : item?.key || item?.value || item?.name || null;

      if (key) {
        keys.push(key);
      }
    }

    if (keys.length === 0) {
      return 0;
    }

    for (const key of keys) {
      await redis.del(key);
    }

    return keys.length;
  } catch (error) {
    console.error('Redis cache clear error:', error.message);
    return 0;
  }
};

module.exports = {
  cacheResponse,
  clearCacheByPattern,
};