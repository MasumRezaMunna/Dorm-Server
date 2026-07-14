import mongoose from 'mongoose';

const expenseSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    expenseType: {
      type: String,
      enum: ['Grocery', 'Common'],
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    date: {
      type: Date,
      required: true,
      default: Date.now,
    },
    month: { type: Number, required: true, min: 1, max: 12, index: true },
    year: { type: Number, required: true, index: true },
    receipt: {
      type: String, // Firebase Storage URL
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    notes: String,
  },
  { timestamps: true }
);

// Compound index for month/year filtering (dashboard analytics)
expenseSchema.index({ month: 1, year: 1, expenseType: 1 });

export default mongoose.model('Expense', expenseSchema);
