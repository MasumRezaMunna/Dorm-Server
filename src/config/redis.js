import { createClient } from 'redis';
import logger from '../utils/logger.js';

/**
 * Singleton Redis client reference
 */
export let redisClient = null;

let isConnected = false;
let isConnecting = false;
let hasLoggedFailure = false;

/**
 * Builds the Redis configuration object from environment variables.
 */
const getClientConfig = () => {
  const username = process.env.REDIS_USERNAME || 'default';
  const password = process.env.REDIS_PASSWORD || '';
  const host = process.env.REDIS_HOST || 'localhost';
  const port = parseInt(process.env.REDIS_PORT, 10) || 6379;

  // TLS configuration for production Redis Cloud
  // Defaults to true in production unless explicitly set to 'false' via REDIS_TLS
  const isTls =
    process.env.REDIS_TLS !== undefined
      ? process.env.REDIS_TLS === 'true'
      : process.env.NODE_ENV === 'production';

  // Support direct REDIS_URL if provided and no REDIS_HOST specified
  if (process.env.REDIS_URL && !process.env.REDIS_HOST) {
    return {
      url: process.env.REDIS_URL,
      socket: {
        ...(isTls ? { tls: true } : {}),
        reconnectStrategy: (retries) => {
          if (retries > 5) {
            if (!hasLoggedFailure) {
              logger.warn('⚠️ [CACHE WARNING] Redis reconnect retries exceeded. Operating in DB fallback mode.');
              hasLoggedFailure = true;
            }
            return 30000;
          }
          return Math.min(retries * 500, 3000);
        },
        connectTimeout: 8000,
      },
    };
  }

  return {
    username,
    password,
    socket: {
      host,
      port,
      ...(isTls ? { tls: true } : {}),
      reconnectStrategy: (retries) => {
        if (retries > 5) {
          if (!hasLoggedFailure) {
            logger.warn('⚠️ [CACHE WARNING] Redis reconnect retries exceeded. Operating in DB fallback mode.');
            hasLoggedFailure = true;
          }
          return 30000;
        }
        return Math.min(retries * 500, 3000);
      },
      connectTimeout: 8000,
    },
  };
};

/**
 * Initializes and connects to Redis Cloud.
 *
 * Requirements:
 * - Uses createClient() from official 'redis' package.
 * - Reads REDIS_USERNAME, REDIS_PASSWORD, REDIS_HOST, REDIS_PORT, REDIS_ENABLED.
 * - Avoids creating multiple concurrent connections.
 * - Handles connection failures gracefully without throwing errors.
 * - If Redis is unavailable, the application continues normally using MongoDB.
 * - No top-level await.
 */
export const connectRedis = async () => {
  const isEnabled = process.env.REDIS_ENABLED !== 'false';
  if (!isEnabled) {
    logger.info('ℹ️ Redis caching is disabled via REDIS_ENABLED=false. Bypassing cache.');
    return null;
  }

  // Avoid creating multiple connections if already connected or connecting
  if (redisClient && (redisClient.isOpen || isConnecting)) {
    return redisClient;
  }

  try {
    isConnecting = true;
    const config = getClientConfig();
    redisClient = createClient(config);

    // Register event listeners
    redisClient.on('connect', () => {
      logger.info('🔌 Redis client connecting...');
    });

    redisClient.on('ready', () => {
      isConnected = true;
      isConnecting = false;
      hasLoggedFailure = false;
      logger.info('✅ Redis Cloud connected and ready for caching');
    });

    redisClient.on('error', (err) => {
      isConnected = false;
      if (!hasLoggedFailure) {
        logger.warn(`⚠️ [CACHE ERROR] Redis Client Error: ${err.message}. Operating in DB fallback mode.`);
        hasLoggedFailure = true;
      }
    });

    redisClient.on('reconnecting', () => {
      logger.info('🔄 Redis reconnecting...');
    });

    redisClient.on('end', () => {
      isConnected = false;
      isConnecting = false;
      logger.info('🛑 Redis connection closed');
    });

    await redisClient.connect();
    isConnecting = false;
    return redisClient;
  } catch (err) {
    isConnected = false;
    isConnecting = false;
    if (!hasLoggedFailure) {
      logger.warn(`⚠️ [CACHE WARNING] Failed to connect to Redis (${err.message}). Application will function normally using MongoDB.`);
      hasLoggedFailure = true;
    }
    return null;
  }
};

/**
 * Check if Redis is currently connected and operational
 */
export const isRedisAvailable = () => {
  const isEnabled = process.env.REDIS_ENABLED !== 'false';
  return isEnabled && isConnected && redisClient !== null && redisClient.isOpen;
};

/**
 * Safely get a parsed JSON value from Redis
 */
export const safeGet = async (key) => {
  if (!isRedisAvailable()) return null;
  try {
    const data = await redisClient.get(key);
    return data ? JSON.parse(data) : null;
  } catch (err) {
    logger.warn(`⚠️ [CACHE GET ERROR] Key "${key}": ${err.message}`);
    return null;
  }
};

/**
 * Safely set a value in Redis with TTL (in seconds)
 */
export const safeSet = async (key, value, ttlSeconds = 60) => {
  if (!isRedisAvailable()) return false;
  try {
    const stringVal = JSON.stringify(value);
    if (ttlSeconds && ttlSeconds > 0) {
      await redisClient.set(key, stringVal, { EX: ttlSeconds });
    } else {
      await redisClient.set(key, stringVal);
    }
    return true;
  } catch (err) {
    logger.warn(`⚠️ [CACHE SET ERROR] Key "${key}": ${err.message}`);
    return false;
  }
};

/**
 * Safely delete one or more keys from Redis
 */
export const safeDel = async (...keys) => {
  if (!isRedisAvailable() || keys.length === 0) return 0;
  try {
    const flatKeys = keys.flat().filter(Boolean);
    if (flatKeys.length === 0) return 0;
    return await redisClient.del(flatKeys);
  } catch (err) {
    logger.warn(`⚠️ [CACHE DEL ERROR] Keys [${keys.join(', ')}]: ${err.message}`);
    return 0;
  }
};

/**
 * Delete keys matching a pattern using non-blocking SCAN
 */
export const deleteByPattern = async (pattern) => {
  if (!isRedisAvailable() || !pattern) return 0;
  try {
    let cursor = 0;
    let deletedCount = 0;
    do {
      const reply = await redisClient.scan(cursor, {
        MATCH: pattern,
        COUNT: 100,
      });
      cursor = reply.cursor;
      const keys = reply.keys;
      if (keys && keys.length > 0) {
        const count = await redisClient.del(keys);
        deletedCount += count;
      }
    } while (cursor !== 0);

    return deletedCount;
  } catch (err) {
    logger.warn(`⚠️ [CACHE SCAN ERROR] Pattern "${pattern}": ${err.message}`);
    return 0;
  }
};

/**
 * Getter for Redis client instance
 */
export const getRedisClient = () => redisClient;

/**
 * Gracefully disconnect from Redis
 */
export const disconnectRedis = async () => {
  if (redisClient && redisClient.isOpen) {
    try {
      await redisClient.quit();
      logger.info('Redis disconnected gracefully');
    } catch (err) {
      logger.warn(`Redis quit error: ${err.message}`);
    }
  }
};
