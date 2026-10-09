import { Router } from 'express';
import { authRateLimiter } from '../middlewares/rateLimiter.js';
import { googleLogin, refreshToken, getMe, logout } from '../controllers/auth.controller.js';
import { mobileGoogleStart, mobileGoogleCallback } from '../controllers/mobileAuth.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

const router = Router();

// POST /api/auth/google — Exchange Firebase ID token for our JWT (web app)
router.post('/google', authRateLimiter, googleLogin);

// POST /api/auth/refresh — Refresh JWT using Firebase ID token or active JWT
router.post('/refresh', authRateLimiter, refreshToken);

// GET /api/auth/mobile/google — Start server-side Google OAuth for mobile app
router.get('/mobile/google', mobileGoogleStart);

// GET /api/auth/mobile/google/callback — Handle Google OAuth callback for mobile app
router.get('/mobile/google/callback', mobileGoogleCallback);

// GET /api/auth/me — Get current authenticated user
router.get('/me', requireAuth, getMe);

// POST /api/auth/logout — Logout
router.post('/logout', requireAuth, logout);

export default router;
