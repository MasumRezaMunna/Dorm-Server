import { auth } from '../config/firebase.js';
import User from '../models/user.model.js';
import jwt from 'jsonwebtoken';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import { AppError } from '../utils/AppError.js';
import Member from '../models/member.model.js';

/**
 * POST /api/auth/google
 * Verifies Firebase ID token → creates/finds user → returns our JWT
 */
export const googleLogin = async (req, res, next) => {
  try {
    const { idToken } = req.body;
    if (!idToken) return next(new AppError('Firebase ID token is required', 400));

    // Verify with Firebase Admin
    const decoded = await auth.verifyIdToken(idToken);
    const { uid, email, name, picture } = decoded;

    // Find or create user
    let user = await User.findOne({ firebaseUid: uid });
    if (!user) {
      user = await User.create({
        firebaseUid: uid,
        email,
        displayName: name || email.split('@')[0],
        photoURL: picture || null,
        role: 'member', // default role — manager promotes manually
      });
    }

    if (!user.isActive) {
      return next(new AppError('Your account has been deactivated. Contact the manager.', 403));
    }

    // Issue our own JWT
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    return sendSuccess(res, { token, user }, 'Login successful', 200);
  } catch (err) {
    // Firebase verification failure
    if (err.code?.startsWith('auth/')) {
      return next(new AppError('Invalid or expired Firebase token', 401));
    }
    next(err);
  }
};

/**
 * GET /api/auth/me
 * Returns the current authenticated user (from req.user set by requireAuth middleware)
 * Also ensures managers have a Member profile created automatically.
 */
export const getMe = async (req, res, next) => {
  try {
    if (req.user.role === 'manager') {
      const existingMember = await Member.findOne({ userId: req.user._id });
      if (!existingMember) {
        const count = await Member.countDocuments();
        const memberId = `MEM-${String(count + 1).padStart(3, '0')}`;
        await Member.create({
          userId: req.user._id,
          memberId,
          status: 'active'
        });
      }
    }
    sendSuccess(res, req.user, 'User retrieved');
  } catch (err) { next(err); }
};

/**
 * POST /api/auth/logout
 * For JWT, logout is handled client-side (drop the token).
 * This endpoint exists for completeness and future token blacklisting.
 */
export const logout = (_req, res) => {
  sendSuccess(res, null, 'Logged out successfully');
};
