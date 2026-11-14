import { Router } from 'express';
import * as communicationController from '../controllers/communicationController.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';

const router = Router();

// All communication routes require authentication
router.use(authenticateToken);

// Announcements routes
router.get('/announcements', communicationController.listAnnouncements);
router.post('/announcements', requireRole('ADMIN', 'TEACHER'), communicationController.createAnnouncement);
router.get('/announcements/:id', communicationController.getAnnouncement);
router.put('/announcements/:id', requireRole('ADMIN', 'TEACHER'), communicationController.updateAnnouncement);
router.delete('/announcements/:id', requireRole('ADMIN', 'TEACHER'), communicationController.deleteAnnouncement);
router.post('/announcements/:id/read', communicationController.markAnnouncementRead);

// Direct Messages routes
router.get('/messages/unread-count', communicationController.getUnreadCount);
router.get('/messages', communicationController.listMessages);
router.post('/messages', communicationController.sendMessage);
router.get('/messages/threads/:threadId', communicationController.getMessageThread);
router.post('/messages/threads/:threadId/reply', communicationController.replyToMessage);
router.patch('/messages/:id/read', communicationController.markMessageRead);

export default router;
