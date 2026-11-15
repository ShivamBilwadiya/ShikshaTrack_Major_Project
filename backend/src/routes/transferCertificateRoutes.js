import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import * as tcController from '../controllers/transferCertificateController.js';

const router = Router();

// Student Exit & Transfer Certificate issuance is restricted to authenticated ADMINs
router.use(authenticateToken);
router.use(requireRole('ADMIN'));

router.get('/preview/:studentId', tcController.getStudentExitPreview);
router.post('/issue', tcController.issueTransferCertificate);
router.get('/history', tcController.getTransferCertificateHistory);
router.get('/download/:id', tcController.downloadTransferCertificatePdf);

export default router;
