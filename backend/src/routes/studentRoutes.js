import { Router } from 'express';
import * as studentController from '../controllers/studentController.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';

const router = Router();

router.use(authenticateToken);

router.get('/', studentController.getStudents);
router.get('/cards', studentController.getPrintableCards);
router.get('/qr/:token', studentController.getStudentByQr);
router.get('/:id', studentController.getStudent);

// Student modifications require ADMIN
router.post('/', requireRole('ADMIN'), studentController.createStudent);
router.put('/:id', requireRole('ADMIN'), studentController.updateStudent);
router.post('/:id/regenerate-qr', requireRole('ADMIN'), studentController.regenerateQr);

export default router;

