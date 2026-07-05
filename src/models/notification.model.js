import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ['bill', 'payment', 'notice', 'complaint', 'visitor', 'system', 'meal'],
      default: 'system',
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    link: {
      type: String, // Frontend route to navigate to on click
      default: null,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed, // Extra data (e.g., billId, complaintId)
      default: {},
    },
  },
  { timestamps: true }
);

// Index for fast unread count queries
notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });

export default mongoose.model('Notification', notificationSchema);
