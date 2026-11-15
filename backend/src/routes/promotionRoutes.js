import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import * as promotionController from '../controllers/promotionController.js';

const router = Router();

// Promotion workflows are strictly restricted to authenticated ADMIN users
router.use(authenticateToken);
router.use(requireRole('ADMIN'));

router.get('/classes', promotionController.getPromotionClasses);
router.post('/preview', promotionController.previewPromotion);
router.post('/validate-mapping', promotionController.validateMapping);
router.post('/execute', promotionController.executePromotion);

export default router;
