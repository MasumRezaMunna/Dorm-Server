import mongoose from 'mongoose';

const settingsSchema = new mongoose.Schema(
  {
    // Singleton document — there's only one settings doc
    dormName: {
      type: String,
      default: '4/67 Home',
    },
    address: String,
    managerContact: String,
    currency: {
      type: String,
      default: 'BDT',
    },
    currencySymbol: {
      type: String,
      default: '৳',
    },
    // Meal settings
    mealRate: {
      type: Number,
      default: 80, // BDT per meal
    },
    // Day of month bills are generated
    billGenerationDay: {
      type: Number,
      default: 1,
      min: 1,
      max: 28,
    },
    // Utility rates for pre-filling bill generation
    defaultRates: {
      wifi: { type: Number, default: 500 },
      water: { type: Number, default: 200 },
      gas: { type: Number, default: 300 },
    },
    maintenanceContact: String,
    socialLinks: {
      facebook: String,
      whatsapp: String,
    },
    logoUrl: String,
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

export default mongoose.model('Settings', settingsSchema);
