import { Router } from 'express';
import * as leaveController from '../controllers/leaveController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

router.use(authenticateToken);

// Read and export operations
router.get('/', leaveController.listLeaves);
router.get('/summary', leaveController.getLeaveSummary);
router.get('/attendance-check', leaveController.getApprovedLeavesForAttendance);
router.get('/export', leaveController.exportCsv);
router.get('/student/:studentId', leaveController.getStudentLeaveHistory);
router.get('/:id', leaveController.getLeave);

// Application, review, and cancellation operations
router.post('/', leaveController.applyLeave);
router.post('/bulk-review', leaveController.bulkReview);
router.post('/:id/review', leaveController.reviewLeave);
router.post('/:id/cancel', leaveController.cancelLeave);

export default router;
