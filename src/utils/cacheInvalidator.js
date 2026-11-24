import { deleteByPattern, safeDel, isRedisAvailable } from '../config/redis.js';
import { CACHE_PREFIX } from './cacheKeys.js';
import { cacheMetrics } from './cacheMetrics.js';
import logger from './logger.js';

/**
 * Log helper for cache invalidations
 */
const logInvalidation = (scope, detail = '') => {
  cacheMetrics.recordInvalidation(scope);
  logger.info(`[CACHE INVALIDATED] ${scope}${detail ? ` (${detail})` : ''}`);
};

/**
 * Reusable, domain-specific cache invalidation helpers.
 * When data is created, updated, or deleted, call the corresponding helper.
 */
export const cacheInvalidator = {
  /**
   * Invalidates all financial summaries and dashboards across the app.
   * Crucial for accounting integrity whenever payments, expenses, or meal totals change.
   */
  async invalidateFinancials({ year, month } = {}) {
    if (!isRedisAvailable()) return;

    try {
      // Invalidate manager, member, and community dashboards
      await Promise.all([
        deleteByPattern(`${CACHE_PREFIX}:dash:*`),
        deleteByPattern(`${CACHE_PREFIX}:meal:detail:*`),
        deleteByPattern(`${CACHE_PREFIX}:meal:summary:*`),
        deleteByPattern(`${CACHE_PREFIX}:expense:summary:*`),
        deleteByPattern(`${CACHE_PREFIX}:public:overview:*`),
        deleteByPattern(`${CACHE_PREFIX}:public:community:*`),
        deleteByPattern(`${CACHE_PREFIX}:public:meals:detail:*`),
      ]);

      logInvalidation('Financials & Dashboards', year && month ? `${year}-${month}` : 'all');
    } catch (err) {
      logger.warn(`Failed to invalidate financial caches: ${err.message}`);
    }
  },

  /**
   * Invalidates meal-related caches (entries, summaries, user meals)
   */
  async invalidateMeals({ memberId } = {}) {
    if (!isRedisAvailable()) return;

    try {
      await Promise.all([
        deleteByPattern(`${CACHE_PREFIX}:meal:list:*`),
        deleteByPattern(`${CACHE_PREFIX}:meal:summary:*`),
        deleteByPattern(`${CACHE_PREFIX}:meal:detail:*`),
        deleteByPattern(`${CACHE_PREFIX}:meal:my:*`),
        deleteByPattern(`${CACHE_PREFIX}:public:meals:*`),
        // Also invalidate financials since meals affect meal rate and billing
        this.invalidateFinancials(),
      ]);

      logInvalidation('Meals', memberId ? `memberId: ${memberId}` : '');
    } catch (err) {
      logger.warn(`Failed to invalidate meal caches: ${err.message}`);
    }
  },

  /**
   * Invalidates weekly meal plan
   */
  async invalidateWeeklyPlan() {
    if (!isRedisAvailable()) return;

    try {
      await Promise.all([
        deleteByPattern(`${CACHE_PREFIX}:meal:weekly:*`),
        deleteByPattern(`${CACHE_PREFIX}:public:meals:weekly:*`),
      ]);

      logInvalidation('Weekly Meal Plan');
    } catch (err) {
      logger.warn(`Failed to invalidate weekly plan caches: ${err.message}`);
    }
  },

  /**
   * Invalidates expense-related caches (grocery, common costs, summaries)
   */
  async invalidateExpenses() {
    if (!isRedisAvailable()) return;

    try {
      await Promise.all([
        deleteByPattern(`${CACHE_PREFIX}:expense:*`),
        deleteByPattern(`${CACHE_PREFIX}:public:expenses:*`),
        // Expenses directly alter grocery/common costs, meal rates, and net balance
        this.invalidateFinancials(),
      ]);

      logInvalidation('Expenses & Grocery');
    } catch (err) {
      logger.warn(`Failed to invalidate expense caches: ${err.message}`);
    }
  },

  /**
   * Invalidates payment-related caches
   */
  async invalidatePayments({ memberId } = {}) {
    if (!isRedisAvailable()) return;

    try {
      await Promise.all([
        deleteByPattern(`${CACHE_PREFIX}:payment:*`),
        // Payments alter monthly income, carry forward effective paid, and balances
        this.invalidateFinancials(),
      ]);

      logInvalidation('Payments', memberId ? `member: ${memberId}` : '');
    } catch (err) {
      logger.warn(`Failed to invalidate payment caches: ${err.message}`);
    }
  },

  /**
   * Invalidates member caches (lists, profiles, room memberships)
   */
  async invalidateMembers({ memberId, userId } = {}) {
    if (!isRedisAvailable()) return;

    try {
      await Promise.all([
        deleteByPattern(`${CACHE_PREFIX}:member:*`),
        deleteByPattern(`${CACHE_PREFIX}:market:rotation*`),
        deleteByPattern(`${CACHE_PREFIX}:room:*`),
        deleteByPattern(`${CACHE_PREFIX}:public:rooms:*`),
        // Active member count changes alter commonCostPerMember!
        this.invalidateFinancials(),
      ]);

      logInvalidation('Members', memberId || userId ? `id: ${memberId || userId}` : '');
    } catch (err) {
      logger.warn(`Failed to invalidate member caches: ${err.message}`);
    }
  },

  /**
   * Invalidates market schedule caches
   */
  async invalidateMarketSchedules({ userId } = {}) {
    if (!isRedisAvailable()) return;

    try {
      await Promise.all([
        deleteByPattern(`${CACHE_PREFIX}:market:*`),
        deleteByPattern(`${CACHE_PREFIX}:public:market:*`),
        deleteByPattern(`${CACHE_PREFIX}:public:overview:*`),
      ]);

      logInvalidation('Market Schedules', userId ? `user: ${userId}` : '');
    } catch (err) {
      logger.warn(`Failed to invalidate market schedule caches: ${err.message}`);
    }
  },

  /**
   * Invalidates notice caches
   */
  async invalidateNotices({ id } = {}) {
    if (!isRedisAvailable()) return;

    try {
      await Promise.all([
        deleteByPattern(`${CACHE_PREFIX}:notice:*`),
        deleteByPattern(`${CACHE_PREFIX}:public:notices:*`),
        deleteByPattern(`${CACHE_PREFIX}:public:notice:*`),
        deleteByPattern(`${CACHE_PREFIX}:public:overview:*`),
        deleteByPattern(`${CACHE_PREFIX}:dash:manager:*`),
        deleteByPattern(`${CACHE_PREFIX}:dash:member:*`),
      ]);

      logInvalidation('Notices', id ? `id: ${id}` : '');
    } catch (err) {
      logger.warn(`Failed to invalidate notice caches: ${err.message}`);
    }
  },

  /**
   * Invalidates room caches
   */
  async invalidateRooms({ id, userId } = {}) {
    if (!isRedisAvailable()) return;

    try {
      await Promise.all([
        deleteByPattern(`${CACHE_PREFIX}:room:*`),
        deleteByPattern(`${CACHE_PREFIX}:public:rooms:*`),
        deleteByPattern(`${CACHE_PREFIX}:public:room:*`),
        deleteByPattern(`${CACHE_PREFIX}:public:overview:*`),
        deleteByPattern(`${CACHE_PREFIX}:dash:manager:*`),
        deleteByPattern(`${CACHE_PREFIX}:dash:member:*`),
      ]);

      logInvalidation('Rooms', id ? `id: ${id}` : '');
    } catch (err) {
      logger.warn(`Failed to invalidate room caches: ${err.message}`);
    }
  },

  /**
   * Invalidates complaint caches
   */
  async invalidateComplaints({ id, userId } = {}) {
    if (!isRedisAvailable()) return;

    try {
      await Promise.all([
        deleteByPattern(`${CACHE_PREFIX}:complaint:*`),
        deleteByPattern(`${CACHE_PREFIX}:dash:manager:*`),
      ]);

      logInvalidation('Complaints', id ? `id: ${id}` : '');
    } catch (err) {
      logger.warn(`Failed to invalidate complaint caches: ${err.message}`);
    }
  },

  /**
   * Invalidates settings caches
   */
  async invalidateSettings() {
    if (!isRedisAvailable()) return;

    try {
      await Promise.all([
        safeDel(`${CACHE_PREFIX}:settings:global`, `${CACHE_PREFIX}:public:settings`),
        // Settings changes (like mealRate default) affect calculations and public overview
        this.invalidateFinancials(),
      ]);

      logInvalidation('Settings');
    } catch (err) {
      logger.warn(`Failed to invalidate settings caches: ${err.message}`);
    }
  },

  /**
   * Invalidates user caches
   */
  async invalidateUsers({ id } = {}) {
    if (!isRedisAvailable()) return;

    try {
      await Promise.all([
        deleteByPattern(`${CACHE_PREFIX}:user:*`),
        deleteByPattern(`${CACHE_PREFIX}:dash:manager:*`),
      ]);

      logInvalidation('Users', id ? `id: ${id}` : '');
    } catch (err) {
      logger.warn(`Failed to invalidate user caches: ${err.message}`);
    }
  },
};
