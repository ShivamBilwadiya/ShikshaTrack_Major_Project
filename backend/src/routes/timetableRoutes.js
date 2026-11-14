import { Router } from 'express';
import * as timetableController from '../controllers/timetableController.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';

const router = Router();

// Require authentication for all timetable routes
router.use(authenticateToken);

// Read routes accessible to both ADMIN and TEACHER
router.get('/weekly', timetableController.getWeeklyGrid);
router.get('/my-schedule', timetableController.getMySchedule);
router.post('/validate-slot', timetableController.validateSlot);
router.get('/', timetableController.getTimetable);
router.get('/:id', timetableController.getTimetableEntry);

// Mutation routes restricted to ADMIN
router.post('/', requireRole('ADMIN'), timetableController.createTimetableEntry);
router.put('/:id', requireRole('ADMIN'), timetableController.updateTimetableEntry);
router.delete('/:id', requireRole('ADMIN'), timetableController.deleteTimetableEntry);

export default router;
