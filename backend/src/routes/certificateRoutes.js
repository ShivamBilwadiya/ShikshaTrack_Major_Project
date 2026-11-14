import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import * as certificateController from '../controllers/certificateController.js';

const router = Router();

// PUBLIC ROUTE: Certificate authenticity verification (no auth required)
router.get('/verify/:tokenOrCertNo', certificateController.verifyPublicCertificate);

// All subsequent routes require valid authentication
router.use(authenticateToken);

// Certificate statistics summary
router.get('/stats', certificateController.getCertificateStats);

// Template Management
router.get('/templates', certificateController.getTemplates);
router.get('/templates/:id', certificateController.getTemplateById);
router.post('/templates', requireRole('ADMIN'), certificateController.createTemplate);
router.put('/templates/:id', requireRole('ADMIN'), certificateController.updateTemplate);
router.delete('/templates/:id', requireRole('ADMIN'), certificateController.deleteTemplate);

// Certificate Issuance (Admin and authorized Faculty)
router.post('/issue', requireRole('ADMIN', 'TEACHER'), certificateController.issueCertificate);

// List Issued Certificates (Admin, Teacher, and linked Parent)
router.get('/', certificateController.getCertificates);

// Retrieve single certificate
router.get('/:id', certificateController.getCertificateById);

// Download / View Printable PDF Certificate
router.get('/:id/pdf', certificateController.downloadCertificatePdf);

// Revoke Certificate (Admin only)
router.post('/:id/revoke', requireRole('ADMIN'), certificateController.revokeCertificate);

export default router;
