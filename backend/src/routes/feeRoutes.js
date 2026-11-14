import { Router } from 'express';
import * as feeController from '../controllers/feeController.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';

const router = Router();

router.use(authenticateToken);

// 1. Fee Structures
router.get('/structures', feeController.listStructures);
router.post('/structures', requireRole('ADMIN'), feeController.createStructure);
router.put('/structures/:id', requireRole('ADMIN'), feeController.updateStructure);
router.delete('/structures/:id', requireRole('ADMIN'), feeController.deleteStructure);

// 2. Fee Assignments
router.post('/assign/student', requireRole('ADMIN'), feeController.assignStudentFee);
router.post('/assign/class', requireRole('ADMIN'), feeController.assignClassFee);

// 3. Discounts and Concessions
router.post('/accounts/:id/discount', requireRole('ADMIN'), feeController.applyDiscount);

// 4. Payments and Reversals
router.post('/payments', feeController.recordPayment);
router.post('/payments/:id/reverse', requireRole('ADMIN'), feeController.reversePayment);
router.get('/receipts/:receiptNumber', feeController.getReceipt);

// 5. Statements, Overdue & Reports
router.get('/students/:studentId/statement', feeController.getStudentStatement);
router.get('/overdue', feeController.getOverdueFees);
router.get('/summary', feeController.getCollectionSummary);
router.get('/reports/classes', feeController.getClassCollectionReport);
router.get('/export', feeController.exportCsv);

export default router;
