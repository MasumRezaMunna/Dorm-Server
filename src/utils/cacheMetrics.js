import { isRedisAvailable, getRedisClient } from '../config/redis.js';

/**
 * In-memory thread-safe cache metrics tracker.
 * Aggregates cache hits, misses, sets, invalidations, and errors across the application.
 */
class CacheMetrics {
  constructor() {
    this.hits = 0;
    this.misses = 0;
    this.sets = 0;
    this.invalidations = 0;
    this.errors = 0;
    this.startTime = Date.now();
  }

  recordHit(key) {
    this.hits += 1;
  }

  recordMiss(key) {
    this.misses += 1;
  }

  recordSet(key) {
    this.sets += 1;
  }

  recordInvalidation(scope) {
    this.invalidations += 1;
  }

  recordError(err) {
    this.errors += 1;
  }

  /**
   * Generates public-safe operational statistics.
   * Strips all passwords, connection URLs, and sensitive cached values.
   */
  async getStats() {
    const totalLookups = this.hits + this.misses;
    const hitRatioRaw = totalLookups > 0 ? this.hits / totalLookups : 0;
    const hitRatioPercent = totalLookups > 0 ? `${(hitRatioRaw * 100).toFixed(2)}%` : '0.00%';

    const isConnected = isRedisAvailable();
    const isEnabled = process.env.REDIS_ENABLED !== 'false';

    const stats = {
      redisConnectionStatus: isConnected ? 'connected' : 'disconnected',
      redisEnabled: isEnabled,
      cacheHitCount: this.hits,
      cacheMissCount: this.misses,
      cacheHitRatio: hitRatioPercent,
      cacheHitRatioRaw: Number(hitRatioRaw.toFixed(4)),
      cacheSetCount: this.sets,
      cacheInvalidationCount: this.invalidations,
      cacheErrorCount: this.errors,
      uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
      timestamp: new Date().toISOString(),
    };

    // Safely query Redis operational metrics if client is connected
    if (isConnected) {
      try {
        const client = getRedisClient();
        if (client && client.isOpen) {
          const rawInfo = await client.info();
          const parsed = {};
          rawInfo.split('\r\n').forEach((line) => {
            if (line && !line.startsWith('#')) {
              const colonIdx = line.indexOf(':');
              if (colonIdx > -1) {
                const k = line.substring(0, colonIdx).trim();
                const v = line.substring(colonIdx + 1).trim();
                parsed[k] = v;
              }
            }
          });

          stats.redisServer = {
            version: parsed.redis_version || 'unknown',
            usedMemoryHuman: parsed.used_memory_human || 'unknown',
            connectedClients: parseInt(parsed.connected_clients || '0', 10),
            totalCommandsProcessed: parseInt(parsed.total_commands_processed || '0', 10),
            uptimeInSeconds: parseInt(parsed.uptime_in_seconds || '0', 10),
          };
        }
      } catch (err) {
        // Fallback: omit server details if INFO command cannot be executed
      }
    }

    return stats;
  }

  reset() {
    this.hits = 0;
    this.misses = 0;
    this.sets = 0;
    this.invalidations = 0;
    this.errors = 0;
    this.startTime = Date.now();
  }
}

export const cacheMetrics = new CacheMetrics();
