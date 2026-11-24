import { safeGet, safeSet, isRedisAvailable } from '../config/redis.js';
import { hashQuery, CACHE_PREFIX } from '../utils/cacheKeys.js';
import { cacheMetrics } from '../utils/cacheMetrics.js';
import logger from '../utils/logger.js';

/**
 * Cache Middleware implementing the Cache-Aside Pattern with graceful degradation.
 *
 * @param {object} options
 * @param {number} [options.ttl=60] - Time to live in seconds
 * @param {Function} [options.keyGenerator] - Custom key generator: (req) => string
 * @param {boolean} [options.isUserSpecific=false] - Whether to scope key to req.user._id
 * @param {boolean} [options.isManagerOnly=false] - Whether this endpoint is manager-only
 */
export const cacheMiddleware = (options = {}) => {
  const {
    ttl = 60,
    keyGenerator,
    isUserSpecific = false,
    isManagerOnly = false,
  } = options;

  return async (req, res, next) => {
    // Only GET requests are eligible for caching
    if (req.method !== 'GET') {
      return next();
    }

    // If Redis is not available, bypass caching transparently
    if (!isRedisAvailable()) {
      res.setHeader('X-Cache', 'BYPASS');
      return next();
    }

    // Role check if marked manager only
    if (isManagerOnly && req.user?.role !== 'manager') {
      return next();
    }

    // User isolation check
    if (isUserSpecific && !req.user?._id) {
      return next();
    }

    let cacheKey;
    try {
      if (typeof keyGenerator === 'function') {
        cacheKey = keyGenerator(req);
      } else {
        const pathPart = `${req.baseUrl || ''}${req.path || ''}`.replace(/\/+/g, ':');
        const queryPart = hashQuery(req.query);
        const userPart = isUserSpecific ? `:user:${req.user._id}` : '';
        cacheKey = `${CACHE_PREFIX}${userPart}${pathPart}:${queryPart}`;
      }
    } catch (err) {
      logger.warn(`⚠️ [CACHE KEY ERROR] ${err.message}. Bypassing cache.`);
      return next();
    }

    if (!cacheKey) {
      return next();
    }

    // ── Cache Lookup ──────────────────────────────────────────────
    try {
      const cached = await safeGet(cacheKey);

      if (cached !== null && cached !== undefined) {
        cacheMetrics.recordHit(cacheKey);
        res.setHeader('X-Cache', 'HIT');
        logger.info(`[CACHE HIT] ${cacheKey}`);
        return res.json(cached);
      }

      // ── Cache Miss ──────────────────────────────────────────────
      cacheMetrics.recordMiss(cacheKey);
      res.setHeader('X-Cache', 'MISS');
      logger.info(`[CACHE MISS] ${cacheKey}`);

      // Intercept res.json to store the response in Redis
      const originalJson = res.json.bind(res);

      res.json = (body) => {
        // Restore original method
        res.json = originalJson;

        // Only cache successful 2xx responses
        if (res.statusCode >= 200 && res.statusCode < 300 && body !== null && body !== undefined) {
          // Asynchronously set cache in background (non-blocking)
          safeSet(cacheKey, body, ttl)
            .then((saved) => {
              if (saved) {
                cacheMetrics.recordSet(cacheKey);
                logger.info(`[CACHE SET] ${cacheKey} (TTL: ${ttl}s)`);
              }
            })
            .catch((err) => {
              cacheMetrics.recordError(err);
              logger.warn(`[CACHE ERROR] ${cacheKey}: ${err.message}`);
            });
        }

        return originalJson(body);
      };

      next();
    } catch (err) {
      cacheMetrics.recordError(err);
      logger.warn(`[CACHE ERROR] Middleware: ${err.message}. Proceeding without cache.`);
      next();
    }
  };
};
