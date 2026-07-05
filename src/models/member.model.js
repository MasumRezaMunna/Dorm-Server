import mongoose from 'mongoose';

const memberSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    memberId: {
      type: String,
      required: true,
      unique: true,
      // e.g., "MEM-001" — generated in service layer
    },
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room',
      default: null,
      index: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    emergencyContact: {
      name: String,
      phone: String,
      relation: String,
    },
    nid: {
      type: String,
      trim: true,
    },
    occupation: {
      type: String,
      trim: true,
    },
    joinDate: {
      type: Date,
      default: Date.now,
    },
    leaveDate: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'left'],
      default: 'active',
      index: true,
    },
    profilePicture: {
      type: String,
      default: null,
    },
    notes: {
      type: String,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Populate user info when querying members
memberSchema.pre(/^find/, function () {
  this.populate('userId', 'displayName email photoURL role isActive');
});

// Virtual: days since joining
memberSchema.virtual('daysInDorm').get(function () {
  const end = this.leaveDate || new Date();
  return Math.floor((end - this.joinDate) / (1000 * 60 * 60 * 24));
});

export default mongoose.model('Member', memberSchema);
