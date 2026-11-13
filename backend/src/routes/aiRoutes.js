import { Router } from 'express';
import * as aiController from '../controllers/aiController.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';

const router = Router();

router.use(authenticateToken);
// AI Insights & Query features are accessible to school administrators
router.use(requireRole('ADMIN'));

router.get('/insights', aiController.getInsights);
router.post('/ask', aiController.askAssistant);
router.post('/generate-report', aiController.generateReport);

export default router;

