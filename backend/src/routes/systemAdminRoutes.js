import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import * as systemAdminController from '../controllers/systemAdminController.js';

const router = Router();

// All administration routes strictly require authentication and ADMIN role
router.use(authenticateToken);
router.use(requireRole('ADMIN'));

// User management endpoints
router.get('/users', systemAdminController.getUsers);
router.patch('/users/:id/status', systemAdminController.setUserStatus);

// Audit logging and activity endpoints
router.get('/audit-logs', systemAdminController.getAuditLogs);
router.get('/activity-summary', systemAdminController.getActivitySummary);

// System health diagnostics
router.get('/health', systemAdminController.getSystemHealth);

export default router;
