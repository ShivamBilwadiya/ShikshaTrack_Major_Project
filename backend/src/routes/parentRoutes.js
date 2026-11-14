import { Router } from 'express';
import * as parentController from '../controllers/parentController.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';

const router = Router();

// All parent routes require authentication
router.use(authenticateToken);

// Parent Portal self-service routes
router.get('/dashboard', parentController.getDashboardData);
router.get('/my-children', requireRole('PARENT'), parentController.getMyChildren);
router.post('/leaves', requireRole('PARENT'), parentController.submitLeave);

// Parent management routes
router.post('/', requireRole('ADMIN'), parentController.createParent);
router.get('/', requireRole('ADMIN'), parentController.listParents);
router.get('/:id', parentController.getParent);
router.put('/:id', parentController.updateParent);
router.post('/:id/link-student', requireRole('ADMIN'), parentController.linkStudent);
router.delete('/:id/unlink-student/:studentId', requireRole('ADMIN'), parentController.unlinkStudent);

export default router;
