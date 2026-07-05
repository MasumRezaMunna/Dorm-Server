import mongoose from 'mongoose';

const visitorSchema = new mongoose.Schema(
  {
    memberId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Member',
      required: true,
      index: true,
    },
    visitorName: {
      type: String,
      required: true,
      trim: true,
    },
    phone: String,
    purpose: String,
    checkIn: {
      type: Date,
      required: true,
      default: Date.now,
    },
    checkOut: {
      type: Date,
      default: null,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'denied', 'checked-out'],
      default: 'pending',
    },
    note: String,
  },
  { timestamps: true }
);

export default mongoose.model('Visitor', visitorSchema);
