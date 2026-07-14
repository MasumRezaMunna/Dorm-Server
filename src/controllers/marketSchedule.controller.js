import MarketSchedule from '../models/marketSchedule.model.js';
import Member from '../models/member.model.js';
import { sendSuccess, parsePagination, buildPagination } from '../utils/apiResponse.js';
import { notFoundError, validationError, conflictError } from '../utils/AppError.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Normalise a date to UTC midnight for unambiguous day comparisons */
const toUTCMidnight = (dateInput) => {
  const d = new Date(dateInput);
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
};

/** Compute status string from a stored marketDate */
const computeStatus = (marketDate) => {
  const todayUTC = toUTCMidnight(new Date());
  const d = toUTCMidnight(marketDate);
  if (d.getTime() === todayUTC.getTime()) return 'today';
  if (d > todayUTC) return 'upcoming';
  return 'completed';
};

// ─── Manager Controllers ──────────────────────────────────────────────────────

/**
 * POST /api/market-schedules
 * Create a new market schedule (manager only)
 */
export const createMarketSchedule = async (req, res, next) => {
  try {
    const { marketDate, members, note } = req.body;

    if (!marketDate) return next(validationError('Market date is required'));
    if (!members || !Array.isArray(members))
      return next(validationError('Members array is required'));
    if (members.length < 2 || members.length > 3)
      return next(validationError('A market team must have 2 or 3 members'));

    // Detect duplicate userIds in members array
    const ids = members.map((m) => m.userId?.toString());
    if (new Set(ids).size !== ids.length)
      return next(validationError('Duplicate members are not allowed'));

    const normalised = toUTCMidnight(marketDate);

    // Past-date guard
    const todayUTC = toUTCMidnight(new Date());
    if (normalised < todayUTC)
      return next(validationError('Cannot schedule a market team for a past date'));

    // One-per-day guard
    const exists = await MarketSchedule.findOne({ marketDate: normalised });
    if (exists) return next(conflictError('A market team is already assigned for this date'));

    const schedule = await MarketSchedule.create({
      marketDate: normalised,
      members,
      note: note || null,
      createdBy: { userId: req.user._id, name: req.user.displayName || req.user.name },
    });

    sendSuccess(res, schedule, 'Market schedule created successfully', 201);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/market-schedules
 * List all schedules with optional filtering / searching (manager only)
 * Query params: status, month, year, search (member name)
 */
export const getMarketSchedules = async (req, res, next) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const { status, month, year, search } = req.query;

    const filter = {};

    const now = new Date();
    const todayUTC = toUTCMidnight(now);
    const tomorrowUTC = new Date(todayUTC.getTime() + 86400000);

    if (status === 'today') {
      filter.marketDate = { $gte: todayUTC, $lt: tomorrowUTC };
    } else if (status === 'upcoming') {
      filter.marketDate = { $gt: todayUTC };
    } else if (status === 'completed') {
      filter.marketDate = { $lt: todayUTC };
    } else if (status === 'thisMonth') {
      const y = year ? Number(year) : now.getFullYear();
      const m = month ? Number(month) : now.getMonth() + 1;
      filter.marketDate = {
        $gte: new Date(Date.UTC(y, m - 1, 1)),
        $lt:  new Date(Date.UTC(y, m, 1)),
      };
    }

    if (search) {
      filter['members.name'] = { $regex: search, $options: 'i' };
    }

    const [schedules, total] = await Promise.all([
      MarketSchedule.find(filter)
        .sort({ marketDate: 1 })
        .skip(skip)
        .limit(limit),
      MarketSchedule.countDocuments(filter),
    ]);

    sendSuccess(res, schedules, 'Market schedules retrieved', 200, buildPagination(page, limit, total));
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/market-schedules/:id
 */
export const getMarketScheduleById = async (req, res, next) => {
  try {
    const schedule = await MarketSchedule.findById(req.params.id);
    if (!schedule) return next(notFoundError('Market schedule'));
    sendSuccess(res, schedule, 'Market schedule retrieved');
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/market-schedules/:id
 * Update date, members, or note (manager only)
 */
export const updateMarketSchedule = async (req, res, next) => {
  try {
    const { marketDate, members, note } = req.body;
    const update = {};

    if (members !== undefined) {
      if (!Array.isArray(members) || members.length < 2 || members.length > 3)
        return next(validationError('A market team must have 2 or 3 members'));
      const ids = members.map((m) => m.userId?.toString());
      if (new Set(ids).size !== ids.length)
        return next(validationError('Duplicate members are not allowed'));
      update.members = members;
    }

    if (marketDate !== undefined) {
      const normalised = toUTCMidnight(marketDate);
      const todayUTC = toUTCMidnight(new Date());
      if (normalised < todayUTC)
        return next(validationError('Cannot set a past date'));

      // Check uniqueness only if date is actually changing
      const current = await MarketSchedule.findById(req.params.id);
      if (!current) return next(notFoundError('Market schedule'));

      if (normalised.getTime() !== new Date(current.marketDate).getTime()) {
        const conflict = await MarketSchedule.findOne({ marketDate: normalised });
        if (conflict) return next(conflictError('A market team is already assigned for this date'));
      }
      update.marketDate = normalised;
    }

    if (note !== undefined) update.note = note;

    const schedule = await MarketSchedule.findByIdAndUpdate(
      req.params.id,
      update,
      { new: true, runValidators: true }
    );
    if (!schedule) return next(notFoundError('Market schedule'));

    sendSuccess(res, schedule, 'Market schedule updated');
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/market-schedules/:id
 */
export const deleteMarketSchedule = async (req, res, next) => {
  try {
    const schedule = await MarketSchedule.findByIdAndDelete(req.params.id);
    if (!schedule) return next(notFoundError('Market schedule'));
    sendSuccess(res, null, 'Market schedule deleted');
  } catch (err) {
    next(err);
  }
};

// ─── Shared Controllers (members + managers) ─────────────────────────────────

/**
 * GET /api/market-schedules/today
 */
export const getTodaySchedule = async (req, res, next) => {
  try {
    const todayUTC   = toUTCMidnight(new Date());
    const tomorrowUTC = new Date(todayUTC.getTime() + 86400000);
    const schedule = await MarketSchedule.findOne({
      marketDate: { $gte: todayUTC, $lt: tomorrowUTC },
    });
    sendSuccess(res, schedule || null, 'Today\'s market schedule retrieved');
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/market-schedules/upcoming
 */
export const getUpcomingSchedules = async (req, res, next) => {
  try {
    const todayUTC    = toUTCMidnight(new Date());
    const tomorrowUTC = new Date(todayUTC.getTime() + 86400000);
    const schedules = await MarketSchedule.find({ marketDate: { $gte: tomorrowUTC } })
      .sort({ marketDate: 1 })
      .limit(10);
    sendSuccess(res, schedules, 'Upcoming market schedules retrieved');
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/market-schedules/history
 */
export const getScheduleHistory = async (req, res, next) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const todayUTC = toUTCMidnight(new Date());
    const [schedules, total] = await Promise.all([
      MarketSchedule.find({ marketDate: { $lt: todayUTC } })
        .sort({ marketDate: -1 })
        .skip(skip)
        .limit(limit),
      MarketSchedule.countDocuments({ marketDate: { $lt: todayUTC } }),
    ]);
    sendSuccess(res, schedules, 'Market history retrieved', 200, buildPagination(page, limit, total));
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/market-schedules/me
 * Returns schedules where the currently logged-in user was a member
 */
export const getMySchedules = async (req, res, next) => {
  try {
    const schedules = await MarketSchedule.find({
      'members.userId': req.user._id,
    }).sort({ marketDate: -1 });

    const todayUTC = toUTCMidnight(new Date());

    // Compute summary
    const completed = schedules.filter((s) => toUTCMidnight(s.marketDate) < todayUTC);
    const upcoming  = schedules.filter((s) => toUTCMidnight(s.marketDate) >= todayUTC);

    const summary = {
      totalDuties: completed.length,
      lastMarketDate: completed[0]?.marketDate || null,
      nextAssignedDate: upcoming.find(
        (s) => toUTCMidnight(s.marketDate).getTime() >= todayUTC.getTime()
      )?.marketDate || null,
    };

    sendSuccess(res, { schedules, summary }, 'My market schedules retrieved');
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/market-schedules/rotation-suggestion
 * Returns all active members sorted by fewest duties → oldest last duty (fairness)
 * Each entry includes: userId, name, email, photo, totalDuties, lastMarketDate, nextAssignedDate
 */
export const getRotationSuggestion = async (req, res, next) => {
  try {
    // 1. Fetch all active members with their user info
    const members = await Member.find({ status: 'active' });

    const todayUTC = toUTCMidnight(new Date());

    // 2. Aggregate duty counts per userId
    const dutyStats = await MarketSchedule.aggregate([
      { $unwind: '$members' },
      {
        $group: {
          _id: '$members.userId',
          totalDuties:  { $sum: 1 },
          lastDate:     { $max: { $cond: [{ $lt: ['$marketDate', todayUTC] }, '$marketDate', null] } },
          nextDate:     { $min: { $cond: [{ $gte: ['$marketDate', todayUTC] }, '$marketDate', null] } },
        },
      },
    ]);

    const statsMap = dutyStats.reduce((acc, s) => {
      acc[s._id.toString()] = s;
      return acc;
    }, {});

    // 3. Build suggestion list
    const suggestions = members.map((m) => {
      const uid  = m.userId?._id?.toString() || m.userId?.toString();
      const stat = statsMap[uid] || { totalDuties: 0, lastDate: null, nextDate: null };
      return {
        userId:        m.userId?._id || m.userId,
        name:          m.userId?.displayName || 'Unknown',
        email:         m.userId?.email || '',
        photo:         m.userId?.photoURL || null,
        totalDuties:   stat.totalDuties,
        lastMarketDate: stat.lastDate,
        nextAssignedDate: stat.nextDate,
      };
    });

    // 4. Sort: fewest duties first, then oldest lastDate first (null = never → highest priority)
    suggestions.sort((a, b) => {
      if (a.totalDuties !== b.totalDuties) return a.totalDuties - b.totalDuties;
      if (!a.lastMarketDate) return -1;
      if (!b.lastMarketDate) return 1;
      return new Date(a.lastMarketDate) - new Date(b.lastMarketDate);
    });

    sendSuccess(res, suggestions, 'Rotation suggestion retrieved');
  } catch (err) {
    next(err);
  }
};

// ─── Dashboard Stats Helper (used by dashboard.controller.js if desired) ─────

/**
 * GET /api/market-schedules/stats
 * Quick counts: total, upcoming, today, completed
 */
export const getMarketStats = async (req, res, next) => {
  try {
    const todayUTC    = toUTCMidnight(new Date());
    const tomorrowUTC = new Date(todayUTC.getTime() + 86400000);

    const [total, upcoming, todayCount, completed] = await Promise.all([
      MarketSchedule.countDocuments(),
      MarketSchedule.countDocuments({ marketDate: { $gt: todayUTC } }),
      MarketSchedule.countDocuments({ marketDate: { $gte: todayUTC, $lt: tomorrowUTC } }),
      MarketSchedule.countDocuments({ marketDate: { $lt: todayUTC } }),
    ]);

    sendSuccess(res, { total, upcoming, today: todayCount, completed }, 'Market stats retrieved');
  } catch (err) {
    next(err);
  }
};
