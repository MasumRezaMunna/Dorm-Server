import mongoose from 'mongoose';

const billSchema = new mongoose.Schema(
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
    // Bill line items (BDT ৳)
    rent: { type: Number, default: 0 },
    electricity: { type: Number, default: 0 },
    wifi: { type: Number, default: 0 },
    water: { type: Number, default: 0 },
    gas: { type: Number, default: 0 },
    mealCost: { type: Number, default: 0 },
    otherCharges: { type: Number, default: 0 },
    otherChargesNote: { type: String },
    // Calculated totals
    totalAmount: {
      type: Number,
      required: true,
    },
    paidAmount: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['pending', 'partial', 'paid'],
      default: 'pending',
      index: true,
    },
    dueDate: {
      type: Date,
    },
    generatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    note: String,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Compound index: one bill per member per month-year
billSchema.index({ memberId: 1, month: 1, year: 1 }, { unique: true });

// Virtual: outstanding balance
billSchema.virtual('balance').get(function () {
  return this.totalAmount - this.paidAmount;
});

// Auto-update status on save
billSchema.pre('save', function () {
  if (this.paidAmount >= this.totalAmount) {
    this.status = 'paid';
  } else if (this.paidAmount > 0) {
    this.status = 'partial';
  } else {
    this.status = 'pending';
  }
});

export default mongoose.model('Bill', billSchema);
