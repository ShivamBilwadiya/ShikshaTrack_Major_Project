import { Router } from 'express';
import * as examController from '../controllers/examController.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';

const router = Router();

router.use(authenticateToken);

// Read routes accessible to both ADMIN and TEACHER
router.get('/', examController.getExams);
router.get('/:id', examController.getExam);
router.get('/:id/results', examController.getClassResults);
router.get('/:id/results/export', examController.exportClassResultsCsv);

// Marks entry (teachers or admin)
router.post('/subjects/:subjectId/marks', examController.recordMarks);

// Administrative operations
router.post('/', requireRole('ADMIN'), examController.createExam);
router.put('/:id', requireRole('ADMIN'), examController.updateExam);
router.delete('/:id', requireRole('ADMIN'), examController.deleteExam);
router.post('/:id/subjects', requireRole('ADMIN'), examController.addSubject);

export default router;
