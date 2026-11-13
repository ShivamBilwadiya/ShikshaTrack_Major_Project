import { Router } from 'express';
import * as teacherController from '../controllers/teacherController.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';

const router = Router();

router.use(authenticateToken);

// Teacher management is strictly for ADMIN
router.get('/', requireRole('ADMIN'), teacherController.getTeachers);
router.get('/:id', requireRole('ADMIN'), teacherController.getTeacher);
router.post('/', requireRole('ADMIN'), teacherController.createTeacher);
router.put('/:id/assignments', requireRole('ADMIN'), teacherController.updateTeacherAssignments);
router.patch('/:id/toggle-status', requireRole('ADMIN'), teacherController.toggleTeacherStatus);

export default router;

