import { Router } from 'express';
import * as analyticsController from '../controllers/analyticsController.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';

const router = Router();

router.use(authenticateToken);

// Existing dashboard endpoints
router.get('/admin', requireRole('ADMIN'), analyticsController.getAdminStats);
router.get('/teacher', analyticsController.getTeacherStats);
router.get('/anomalies', requireRole('ADMIN'), analyticsController.getAnomalies);

// Comprehensive student performance and attendance insights
router.get('/students', analyticsController.getStudentInsights);
router.get('/students/:id', analyticsController.getStudentDetailInsights);
router.get('/cohorts', analyticsController.getCohortSummaries);

// Advanced Teacher Performance and Workload Analytics
router.get('/teachers', analyticsController.getTeacherWorkloadAnalytics);
router.get('/teachers/activity/trends', analyticsController.getTeacherActivityTrends);
router.get('/teachers/:id', analyticsController.getTeacherDetailAnalytics);

export default router;
