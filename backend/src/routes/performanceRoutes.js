import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import * as performanceController from '../controllers/performanceController.js';

const router = Router();

// All performance intelligence routes require authentication
router.use(authenticateToken);

// Analytics endpoints (Admin & Teacher only)
router.get('/overview', requireRole('ADMIN', 'TEACHER'), performanceController.getOverview);
router.get('/subjects', requireRole('ADMIN', 'TEACHER'), performanceController.getSubjects);
router.get('/trends', requireRole('ADMIN', 'TEACHER'), performanceController.getTrends);
router.get('/classes', requireRole('ADMIN', 'TEACHER'), performanceController.getClassComparisons);
router.get('/at-risk', requireRole('ADMIN', 'TEACHER'), performanceController.getAtRisk);
router.get('/correlation', requireRole('ADMIN', 'TEACHER'), performanceController.getCorrelation);
router.get('/export', requireRole('ADMIN', 'TEACHER'), performanceController.exportReportCsv);

// Individual student drill-down (supports Admin, Teacher, and linked Parent)
router.get('/students/:id', performanceController.getStudentDrilldown);

// Intervention management endpoints
router.get('/interventions', performanceController.getInterventions);
router.post('/interventions', requireRole('ADMIN', 'TEACHER'), performanceController.createIntervention);
router.put('/interventions/:id', requireRole('ADMIN', 'TEACHER'), performanceController.updateIntervention);
router.post('/interventions/:id/resolve', requireRole('ADMIN', 'TEACHER'), performanceController.resolveIntervention);
router.post('/interventions/:id/notes', requireRole('ADMIN', 'TEACHER'), performanceController.addInterventionNote);

export default router;
