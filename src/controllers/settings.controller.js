import Settings from '../models/settings.model.js';
import { sendSuccess } from '../utils/apiResponse.js';

export const getSettings = async (req, res, next) => {
  try {
    // Singleton: find or create default settings
    let settings = await Settings.findOne();
    if (!settings) settings = await Settings.create({});
    sendSuccess(res, settings, 'Settings retrieved');
  } catch (err) { next(err); }
};

export const updateSettings = async (req, res, next) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) {
      settings = await Settings.create({ ...req.body, updatedBy: req.user._id });
    } else {
      Object.assign(settings, req.body, { updatedBy: req.user._id });
      await settings.save();
    }
    sendSuccess(res, settings, 'Settings updated');
  } catch (err) { next(err); }
};
