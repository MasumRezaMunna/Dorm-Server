import { Router } from 'express';
import { requireAuth, requireManager } from '../middlewares/auth.middleware.js';
import {
  getMembers,
  getMemberById,
  createMember,
  updateMember,
  deleteMember,
  getMyProfile,
  updateMyProfile,
} from '../controllers/member.controller.js';

const router = Router();

router.get('/me', requireAuth, getMyProfile);
router.put('/me', requireAuth, updateMyProfile);
router.get('/', requireManager, getMembers);
router.post('/', requireManager, createMember);
router.get('/:id', requireAuth, getMemberById);
router.put('/:id', requireManager, updateMember);
router.delete('/:id', requireManager, deleteMember);

export default router;
