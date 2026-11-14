import { Router } from 'express';
import * as calendarController from '../controllers/calendarController.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';

const router = Router();

// All calendar operations require authentication
router.use(authenticateToken);

// Read endpoints accessible to both ADMIN and TEACHER
router.get('/', calendarController.getEvents);
router.get('/:id', calendarController.getEvent);

// Modification endpoints restricted to ADMIN
router.post('/', requireRole('ADMIN'), calendarController.createEvent);
router.put('/:id', requireRole('ADMIN'), calendarController.updateEvent);
router.delete('/:id', requireRole('ADMIN'), calendarController.deleteEvent);

export default router;
