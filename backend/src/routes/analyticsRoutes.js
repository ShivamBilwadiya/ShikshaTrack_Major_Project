import { Router } from 'express';
import * as analyticsController from '../controllers/analyticsController.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';

const router = Router();

router.use(authenticateToken);

router.get('/admin', requireRole('ADMIN'), analyticsController.getAdminStats);
router.get('/teacher', analyticsController.getTeacherStats);
router.get('/anomalies', requireRole('ADMIN'), analyticsController.getAnomalies);

export default router;

