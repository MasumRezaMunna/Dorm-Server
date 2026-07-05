import mongoose from 'mongoose';

const roomSchema = new mongoose.Schema(
  {
    roomNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    floor: {
      type: Number,
      required: true,
    },
    type: {
      type: String,
      enum: ['single', 'double', 'triple', 'quad'],
      default: 'single',
    },
    capacity: {
      type: Number,
      required: true,
      min: 1,
      max: 6,
    },
    rent: {
      type: Number,
      required: true,
      min: 0,
    },
    amenities: {
      type: [String],
      default: [],
      // e.g., ['AC', 'attached bathroom', 'balcony']
    },
    status: {
      type: String,
      enum: ['available', 'occupied', 'maintenance'],
      default: 'available',
      index: true,
    },
    // Current occupants (kept in sync by the member assignment service)
    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Member',
      },
    ],
    description: String,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual: available slots
roomSchema.virtual('availableSlots').get(function () {
  return this.capacity - (this.members?.length || 0);
});

// Auto-update status based on occupancy
roomSchema.pre('save', function () {
  const occupantCount = this.members?.length || 0;
  if (occupantCount >= this.capacity) {
    this.status = 'occupied';
  } else if (this.status !== 'maintenance') {
    this.status = 'available';
  }
});

export default mongoose.model('Room', roomSchema);
