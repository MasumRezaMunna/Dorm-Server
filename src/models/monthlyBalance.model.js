import mongoose from 'mongoose';

/**
 * MonthlyBalance stores the idempotent carry-forward (previous month's
 * "After Deduction") for each member for a given month/year.
 *
 * Rules:
 *  - One document per (memberId, month, year).
 *  - `previousBalance` is the previous month's `afterMeal` value:
 *      positive → member overpaid last month (credit, adds to paid)
 *      negative → member underpaid last month (debt, reduces effective paid)
 *  - `lockedAt` records when the snapshot was first written so we can
 *    audit and detect the exact moment of the carry-forward.
 *  - Once written, updates are idempotent (findOneAndUpdate with $setOnInsert).
 */
const monthlyBalanceSchema = new mongoose.Schema(
  {
    memberId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Member',
      required: true,
      index: true,
    },
    month: {
      type: Number,
      required: true,
      min: 1,
      max: 12,
    },
    year: {
      type: Number,
      required: true,
    },
    /**
     * The previous month's final "After Deduction" balance that is carried
     * forward into this (month, year).
     * Positive  → credit from previous month (previous overpayment).
     * Negative  → debt from previous month   (previous underpayment).
     * Zero      → no carry-forward needed.
     */
    previousBalance: {
      type: Number,
      required: true,
      default: 0,
    },
    /**
     * Audit: which (prevMonth, prevYear) this balance was sourced from.
     */
    sourceMonth: { type: Number },
    sourceYear:  { type: Number },
  },
  {
    timestamps: true,
  }
);

// Unique: one carry-forward record per member per month/year
monthlyBalanceSchema.index(
  { memberId: 1, month: 1, year: 1 },
  { unique: true }
);

export default mongoose.model('MonthlyBalance', monthlyBalanceSchema);
