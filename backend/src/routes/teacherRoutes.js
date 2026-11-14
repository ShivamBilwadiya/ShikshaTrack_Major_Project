import { Router } from 'express';
import * as teacherController from '../controllers/teacherController.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';

const router = Router();

// Teacher management endpoints are strictly accessible by school ADMIN
router.use(authenticateToken);
router.use(requireRole('ADMIN'));

// Teacher profile and collection routes
router.get('/', teacherController.getTeachers);
router.post('/', teacherController.createTeacher);
router.get('/:id', teacherController.getTeacher);
router.put('/:id', teacherController.updateTeacher);
router.patch('/:id', teacherController.updateTeacher);
router.delete('/:id', teacherController.deleteTeacher);

// Teacher assigned classes & workload routes
router.get('/:id/classes', teacherController.getTeacherClasses);
router.put('/:id/assignments', teacherController.updateTeacherAssignments);
router.post('/:id/assignments', teacherController.addTeacherAssignment);
router.delete('/:id/assignments/:classId', teacherController.removeTeacherAssignment);

// Status toggling
router.patch('/:id/toggle-status', teacherController.toggleTeacherStatus);

export default router;
