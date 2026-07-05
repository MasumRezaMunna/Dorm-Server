import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    firebaseUid: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    displayName: {
      type: String,
      required: true,
      trim: true,
    },
    photoURL: {
      type: String,
      default: null,
    },
    role: {
      type: String,
      enum: ['manager', 'member'],
      default: 'member',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true, // adds createdAt, updatedAt automatically
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual: check if user is manager
userSchema.virtual('isManager').get(function () {
  return this.role === 'manager';
});

export default mongoose.model('User', userSchema);
