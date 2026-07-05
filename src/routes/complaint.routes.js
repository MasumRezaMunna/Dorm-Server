import { Router } from 'express';
import { requireAuth, requireManager } from '../middlewares/auth.middleware.js';
import {
  getComplaints, getComplaintById, createComplaint, updateComplaint, resolveComplaint, getMyComplaints, deleteComplaint
} from '../controllers/complaint.controller.js';

const router = Router();

router.get('/my', requireAuth, getMyComplaints);
router.get('/', requireManager, getComplaints);
router.post('/', requireAuth, createComplaint);
router.get('/:id', requireAuth, getComplaintById);
router.put('/:id', requireManager, updateComplaint);
router.delete('/:id', requireManager, deleteComplaint);
router.put('/:id/resolve', requireManager, resolveComplaint);

export default router;
