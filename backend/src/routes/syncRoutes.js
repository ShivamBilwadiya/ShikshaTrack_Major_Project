import { Router } from 'express';
import * as syncController from '../controllers/syncController.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireClassAccess } from '../middleware/rbac.js';

const router = Router();

router.use(authenticateToken);

router.get('/roster/:classId', requireClassAccess('classId'), syncController.downloadRoster);
router.post('/batch', syncController.syncBatch);

export default router;

