import { Router } from 'express';
import { authRateLimiter } from '../middlewares/rateLimiter.js';
import { googleLogin, getMe, logout } from '../controllers/auth.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

const router = Router();

// POST /api/auth/google — Exchange Firebase ID token for our JWT
router.post('/google', authRateLimiter, googleLogin);

// GET /api/auth/me — Get current authenticated user
router.get('/me', requireAuth, getMe);

// POST /api/auth/logout — Logout (client-side token drop, optionally blacklist)
router.post('/logout', requireAuth, logout);

export default router;
