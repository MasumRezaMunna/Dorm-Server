import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema(
  {
    billId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Bill',
      required: true,
      index: true,
    },
    memberId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Member',
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 1,
    },
    method: {
      type: String,
      enum: ['cash', 'bkash', 'nagad', 'rocket', 'bank_transfer', 'other'],
      default: 'cash',
    },
    transactionId: {
      type: String,
      trim: true,
    },
    paidAt: {
      type: Date,
      default: Date.now,
    },
    receivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    note: String,
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('Payment', paymentSchema);
