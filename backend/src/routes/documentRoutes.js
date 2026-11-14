import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import * as documentController from '../controllers/documentController.js';

const router = Router();

// All document routes require authentication
router.use(authenticateToken);

// Document stats summary
router.get('/stats', documentController.getDocumentStats);

// List documents (supports filtering for Admin, Teacher, and linked Parent)
router.get('/', documentController.getDocuments);

// Upload new document (Admin and Teacher)
router.post('/', requireRole('ADMIN', 'TEACHER'), documentController.uploadDocument);

// Get document details & version history
router.get('/:id', documentController.getDocumentById);

// Download document file (supports ?version=N)
router.get('/:id/download', documentController.downloadDocument);

// Upload replacement version (Admin and Teacher)
router.post('/:id/replace', requireRole('ADMIN', 'TEACHER'), documentController.replaceDocumentVersion);

// Verify / review document status (Admin and Teacher)
router.post('/:id/verify', requireRole('ADMIN', 'TEACHER'), documentController.verifyDocument);

// Delete document and all versions (Admin only)
router.delete('/:id', requireRole('ADMIN'), documentController.deleteDocument);

export default router;
