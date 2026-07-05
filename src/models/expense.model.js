import mongoose from 'mongoose';

const expenseSchema = new mongoose.Schema(
  {
    description: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      enum: ['grocery', 'utility', 'maintenance', 'salary', 'miscellaneous', 'other'],
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
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    note: String,
  },
  { timestamps: true }
);

// Compound index for month/year filtering (dashboard analytics)
expenseSchema.index({ month: 1, year: 1, category: 1 });

export default mongoose.model('Expense', expenseSchema);
