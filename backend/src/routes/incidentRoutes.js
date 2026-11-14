import { Router } from 'express';
import * as incidentController from '../controllers/incidentController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

router.use(authenticateToken);

// Read and export operations
router.get('/', incidentController.listIncidents);
router.get('/summary', incidentController.getIncidentSummary);
router.get('/export', incidentController.exportCsv);
router.get('/:id', incidentController.getIncident);

// Creation, status transition, and action history
router.post('/', incidentController.recordIncident);
router.patch('/:id/status', incidentController.updateIncidentStatus);
router.post('/:id/actions', incidentController.addActionHistory);

export default router;
