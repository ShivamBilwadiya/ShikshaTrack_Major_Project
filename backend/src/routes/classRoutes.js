import { Router } from 'express';
import * as classController from '../controllers/classController.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';

const router = Router();

router.use(authenticateToken);

// All authenticated users can list classes
router.get('/', classController.getClasses);
router.get('/:id', classController.getClass);

// Admin-only class modifications
router.post('/', requireRole('ADMIN'), classController.createClass);
router.put('/:id', requireRole('ADMIN'), classController.updateClass);
router.delete('/:id', requireRole('ADMIN'), classController.deleteClass);

export default router;

