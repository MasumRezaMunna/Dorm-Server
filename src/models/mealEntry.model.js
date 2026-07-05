import mongoose from 'mongoose';

const mealEntrySchema = new mongoose.Schema(
  {
    memberId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Member',
      required: true,
      index: true,
    },
    date: {
      type: Date,
      required: true,
    },
    lunch:  { type: Number, default: 0, min: 0 },
    dinner: { type: Number, default: 0, min: 0 },
    // Computed total for backwards-compatibility with summaries
    mealCount: { type: Number, default: 0, min: 0 },
    note: { type: String, trim: true },
    month: { type: Number, required: true, min: 1, max: 12, index: true },
    year:  { type: Number, required: true, index: true },
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Auto-compute mealCount before save
mealEntrySchema.pre('save', function () {
  this.mealCount = (this.lunch || 0) + (this.dinner || 0);
});

// Unique meal entry per member per day
mealEntrySchema.index({ memberId: 1, date: 1 }, { unique: true });

export default mongoose.model('MealEntry', mealEntrySchema);
