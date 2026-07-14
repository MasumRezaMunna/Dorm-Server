import mongoose from 'mongoose';

/**
 * MarketSchedule — stores bazar (market) team assignments.
 * Status is NOT stored — it is computed dynamically from marketDate:
 *   future  → 'upcoming'
 *   today   → 'today'
 *   past    → 'completed'
 */
const memberSnapshotSchema = new mongoose.Schema(
  {
    userId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name:    { type: String, required: true, trim: true },
    email:   { type: String, trim: true },
    photo:   { type: String, default: null },
  },
  { _id: false }
);

const marketScheduleSchema = new mongoose.Schema(
  {
    /** Normalised to UTC midnight so date comparisons are unambiguous */
    marketDate: {
      type: Date,
      required: true,
      unique: true,    // one team per date
      index: true,
    },

    /**
     * Denormalised snapshot so the schedule stays accurate even if member
     * profiles change later. Min 2, max 3 — enforced in controller.
     */
    members: {
      type: [memberSnapshotSchema],
      required: true,
      validate: {
        validator: (arr) => arr.length >= 2 && arr.length <= 3,
        message: 'A market team must have 2 or 3 members.',
      },
    },

    note: {
      type: String,
      trim: true,
      default: null,
    },

    createdBy: {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      name:   { type: String, required: true },
    },
  },
  {
    timestamps: true,
    toJSON:   { virtuals: true },
    toObject: { virtuals: true },
  }
);

/**
 * Virtual: compute status from marketDate at read time.
 * Comparing date-only (no time) to avoid timezone edge cases.
 */
marketScheduleSchema.virtual('status').get(function () {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(this.marketDate);
  d.setHours(0, 0, 0, 0);
  if (d.getTime() === today.getTime()) return 'today';
  if (d > today) return 'upcoming';
  return 'completed';
});

export default mongoose.model('MarketSchedule', marketScheduleSchema);
