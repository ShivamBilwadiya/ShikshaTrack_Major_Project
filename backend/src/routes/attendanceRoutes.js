import { Router } from 'express';
import * as attendanceController from '../controllers/attendanceController.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireClassAccess } from '../middleware/rbac.js';

const router = Router();

router.use(authenticateToken);

router.post('/sessions/start', requireClassAccess('classId'), attendanceController.startSession);
router.get('/sessions', attendanceController.listSessions);
router.get('/sessions/:id', attendanceController.getSession);
router.post('/sessions/:id/close', attendanceController.closeSession);

router.post('/scan', attendanceController.scanQr);
router.post('/manual', attendanceController.markManual);
router.post('/manual/bulk', attendanceController.bulkMarkManual);
router.patch('/records/:id/correct', attendanceController.correctRecord);

export default router;

