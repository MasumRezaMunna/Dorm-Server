import mongoose from 'mongoose';

const dayPlanSchema = new mongoose.Schema(
  {
    dayName: {
      type: String,
      enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
      required: true,
    },
    lunch:  { type: Boolean, default: true },
    dinner: { type: Boolean, default: true },
    lunchNote:  { type: String, trim: true, maxlength: 80, default: '' },
    dinnerNote: { type: String, trim: true, maxlength: 80, default: '' },
  },
  { _id: false }
);

const weeklyMealPlanSchema = new mongoose.Schema(
  {
    // ISO Monday that anchors this week (stored as midnight UTC)
    weekStart: {
      type: Date,
      required: true,
      unique: true,
      index: true,
    },
    days: {
      type: [dayPlanSchema],
      default: [],
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

export default mongoose.model('WeeklyMealPlan', weeklyMealPlanSchema);
