import { Router } from 'express';
import * as syncController from '../controllers/syncController.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireClassAccess, requireRole } from '../middleware/rbac.js';

const router = Router();

router.use(authenticateToken);

// Roster download & batch upload
router.get('/roster/:classId', requireClassAccess('classId'), syncController.downloadRoster);
router.post('/batch', syncController.syncBatch);

// Health, conflict inspection & recovery
router.get('/status', syncController.getSyncStatus);
router.get('/conflicts', syncController.getConflicts);
router.post('/conflicts/:id/resolve', requireRole('ADMIN', 'TEACHER'), syncController.resolveConflict);
router.post('/retry-failed', requireRole('ADMIN', 'TEACHER'), syncController.retryFailed);

export default router;
