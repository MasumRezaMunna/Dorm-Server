import crypto from 'crypto';

/**
 * Prefix for all Dorm Solution cache keys to prevent collision with other applications on the same Redis instance.
 */
export const CACHE_PREFIX = 'dorms';

/**
 * Standard TTL Configurations (in seconds)
 */
export const CACHE_TTL = {
  DASHBOARD: 60,       // 1 minute (aggregate stats, balances)
  FINANCIAL: 60,       // 1 minute (payments, income, expenses)
  EXPENSES: 120,       // 2 minutes (grocery & common expenses)
  MEALS: 120,          // 2 minutes (daily meal entries & summaries)
  WEEKLY_PLAN: 300,    // 5 minutes (weekly menu)
  MARKET: 120,         // 2 minutes (schedules, rotation, duty lists)
  MEMBERS: 300,        // 5 minutes (member profiles, rosters)
  ROOMS: 300,          // 5 minutes (room availability)
  NOTICES: 300,        // 5 minutes (announcements)
  SETTINGS: 600,       // 10 minutes (dorm config, meal rate default)
  USERS: 120,          // 2 minutes (user list, pending approvals)
  COMPLAINTS: 60,      // 1 minute (maintenance requests)
  PUBLIC: 120,         // 2 minutes (public transparency view)
};

/**
 * Generates a deterministic hash from a query object.
 * Sorts keys so ?month=11&year=2026 and ?year=2026&month=11 produce the same cache key.
 */
export const hashQuery = (query = {}) => {
  if (!query || Object.keys(query).length === 0) return 'all';
  const sortedKeys = Object.keys(query).sort();
  const normalized = sortedKeys
    .filter(k => query[k] !== undefined && query[k] !== null && query[k] !== '')
    .map(k => `${k}=${String(query[k]).trim()}`)
    .join('&');
  
  if (!normalized) return 'all';
  // Use MD5 hash for compact, safe keys
  return crypto.createHash('md5').update(normalized).digest('hex').substring(0, 10);
};

/**
 * Cache Key Builders
 */
export const cacheKeys = {
  // ── Dashboards ──────────────────────────────────────
  managerDashboard: (year, month) => `${CACHE_PREFIX}:dash:manager:${year || 'current'}:${month || 'current'}`,
  memberDashboard: (userId, year, month) => `${CACHE_PREFIX}:dash:member:${userId}:${year || 'current'}:${month || 'current'}`,
  communityStats: (year, month) => `${CACHE_PREFIX}:dash:community:${year || 'current'}:${month || 'current'}`,

  // ── Meals ───────────────────────────────────────────
  mealList: (query) => `${CACHE_PREFIX}:meal:list:${hashQuery(query)}`,
  mealSummary: (year, month) => `${CACHE_PREFIX}:meal:summary:${year || 'current'}:${month || 'current'}`,
  mealMonthlyDetail: (year, month) => `${CACHE_PREFIX}:meal:detail:${year || 'current'}:${month || 'current'}`,
  myMeals: (userId, year, month) => `${CACHE_PREFIX}:meal:my:${userId}:${year || 'current'}:${month || 'current'}`,
  weeklyPlan: (date) => `${CACHE_PREFIX}:meal:weekly:${date || 'current'}`,

  // ── Expenses ────────────────────────────────────────
  expenseList: (query) => `${CACHE_PREFIX}:expense:list:${hashQuery(query)}`,
  expenseSummary: (year, month) => `${CACHE_PREFIX}:expense:summary:${year || 'current'}:${month || 'current'}`,
  memberExpenses: (query) => `${CACHE_PREFIX}:expense:member:${hashQuery(query)}`,

  // ── Payments ────────────────────────────────────────
  paymentList: (query) => `${CACHE_PREFIX}:payment:list:${hashQuery(query)}`,
  paymentMember: (memberId) => `${CACHE_PREFIX}:payment:member:${memberId}`,

  // ── Members ─────────────────────────────────────────
  memberList: (query) => `${CACHE_PREFIX}:member:list:${hashQuery(query)}`,
  memberProfile: (userId) => `${CACHE_PREFIX}:member:profile:${userId}`,
  memberItem: (id) => `${CACHE_PREFIX}:member:item:${id}`,

  // ── Market Schedules ────────────────────────────────
  marketList: (query) => `${CACHE_PREFIX}:market:list:${hashQuery(query)}`,
  marketItem: (id) => `${CACHE_PREFIX}:market:item:${id}`,
  marketToday: () => `${CACHE_PREFIX}:market:today`,
  marketUpcoming: () => `${CACHE_PREFIX}:market:upcoming`,
  marketHistory: (query) => `${CACHE_PREFIX}:market:history:${hashQuery(query)}`,
  marketStats: (year, month) => `${CACHE_PREFIX}:market:stats:${year || 'current'}:${month || 'current'}`,
  marketRotation: () => `${CACHE_PREFIX}:market:rotation`,
  marketMy: (userId) => `${CACHE_PREFIX}:market:my:${userId}`,

  // ── Notices ─────────────────────────────────────────
  noticeList: (query) => `${CACHE_PREFIX}:notice:list:${hashQuery(query)}`,
  noticeItem: (id) => `${CACHE_PREFIX}:notice:item:${id}`,

  // ── Rooms ───────────────────────────────────────────
  roomList: (query) => `${CACHE_PREFIX}:room:list:${hashQuery(query)}`,
  roomItem: (id) => `${CACHE_PREFIX}:room:item:${id}`,
  roomMy: (userId) => `${CACHE_PREFIX}:room:my:${userId}`,

  // ── Complaints ──────────────────────────────────────
  complaintList: (query) => `${CACHE_PREFIX}:complaint:list:${hashQuery(query)}`,
  complaintItem: (id) => `${CACHE_PREFIX}:complaint:item:${id}`,
  complaintMy: (userId) => `${CACHE_PREFIX}:complaint:my:${userId}`,

  // ── Settings ────────────────────────────────────────
  settings: () => `${CACHE_PREFIX}:settings:global`,

  // ── Users ───────────────────────────────────────────
  userList: (query) => `${CACHE_PREFIX}:user:list:${hashQuery(query)}`,
  userPending: () => `${CACHE_PREFIX}:user:pending`,
  userItem: (id) => `${CACHE_PREFIX}:user:item:${id}`,

  // ── Public ──────────────────────────────────────────
  publicOverview: (year, month) => `${CACHE_PREFIX}:public:overview:${year || 'current'}:${month || 'current'}`,
  publicSettings: () => `${CACHE_PREFIX}:public:settings`,
  publicNotices: (query) => `${CACHE_PREFIX}:public:notices:${hashQuery(query)}`,
  publicNoticeItem: (id) => `${CACHE_PREFIX}:public:notice:${id}`,
  publicRooms: (query) => `${CACHE_PREFIX}:public:rooms:${hashQuery(query)}`,
  publicRoomItem: (id) => `${CACHE_PREFIX}:public:room:${id}`,
  publicWeeklyMealPlan: (date) => `${CACHE_PREFIX}:public:meals:weekly:${date || 'current'}`,
  publicMonthlyMealDetail: (year, month) => `${CACHE_PREFIX}:public:meals:detail:${year || 'current'}:${month || 'current'}`,
  publicMealEntries: (query) => `${CACHE_PREFIX}:public:meals:entries:${hashQuery(query)}`,
  publicTodayMarketSchedule: () => `${CACHE_PREFIX}:public:market:today`,
  publicUpcomingMarketSchedules: () => `${CACHE_PREFIX}:public:market:upcoming`,
  publicMarketScheduleHistory: (query) => `${CACHE_PREFIX}:public:market:history:${hashQuery(query)}`,
  publicExpenses: (query) => `${CACHE_PREFIX}:public:expenses:${hashQuery(query)}`,
  publicCommunityStats: (year, month) => `${CACHE_PREFIX}:public:community:${year || 'current'}:${month || 'current'}`,
};
