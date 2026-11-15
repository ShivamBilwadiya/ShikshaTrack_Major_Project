import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import * as rolloverController from '../controllers/financialRolloverController.js';

const router = Router();

// Financial archiving & rollover operations are strictly restricted to authenticated ADMINs
router.use(authenticateToken);
router.use(requireRole('ADMIN'));

router.get('/years', rolloverController.getAvailableYears);
router.get('/overview', rolloverController.getYearOverview);
router.post('/preview', rolloverController.previewRollover);
router.post('/archive', rolloverController.archiveYear);
router.post('/copy-structures', rolloverController.copyStructures);
router.get('/archives', rolloverController.getArchives);

export default router;
