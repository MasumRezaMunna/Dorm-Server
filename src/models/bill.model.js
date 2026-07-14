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
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    paidAmount: {
      type: Number,
      min: 0,
      default: 0,
    },
    status: {
      type: String,
      enum: ['pending', 'partial', 'paid', 'overdue'],
      default: 'pending',
    },
    dueDate: {
      type: Date,
    },
    note: String,
  },
  {
    timestamps: true,
  }
);

// Auto-update status based on paidAmount vs totalAmount
billSchema.pre('save', function (next) {
  if (this.totalAmount > 0) {
    if (this.paidAmount >= this.totalAmount) {
      this.status = 'paid';
    } else if (this.paidAmount > 0) {
      this.status = 'partial';
    } else {
      this.status = 'pending';
    }
  }
  next();
});

// Compound index to ensure one bill per member per month/year
billSchema.index({ memberId: 1, month: 1, year: 1 }, { unique: true });

export default mongoose.model('Bill', billSchema);
