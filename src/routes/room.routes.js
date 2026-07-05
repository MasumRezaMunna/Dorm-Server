import { Router } from 'express';
import { requireAuth, requireManager } from '../middlewares/auth.middleware.js';
import {
  getRooms, getRoomById, createRoom, updateRoom, deleteRoom, assignMember, vacateMember,
} from '../controllers/room.controller.js';

const router = Router();

router.get('/', requireAuth, getRooms);
router.post('/', requireManager, createRoom);
router.get('/:id', requireAuth, getRoomById);
router.put('/:id', requireManager, updateRoom);
router.delete('/:id', requireManager, deleteRoom);
router.put('/:id/assign', requireManager, assignMember);
router.put('/:id/vacate', requireManager, vacateMember);

export default router;
