import { Router } from 'express';
import * as notificationController from '../controllers/notificationController.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';

const router = Router();

// All notification routes require authenticated token
router.use(authenticateToken);

router.get('/', notificationController.getNotifications);
router.get('/summary', notificationController.getNotificationSummary);
router.post('/', requireRole('ADMIN'), notificationController.createNotification);
router.post('/generate-alerts', notificationController.generateAlerts);
router.patch('/read-all', notificationController.markAllAsRead);
router.patch('/:id/read', notificationController.markAsRead);
router.delete('/:id', notificationController.deleteNotification);

export default router;
