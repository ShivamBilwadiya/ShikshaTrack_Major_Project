import { Router } from 'express';
import * as reportController from '../controllers/reportController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

router.use(authenticateToken);

router.get('/daily', reportController.getDailyReport);
router.get('/daily/csv', reportController.exportDailyCsv);
router.get('/monthly', reportController.getMonthlyReport);
router.get('/low-attendance', reportController.getLowAttendance);
router.get('/mid-day-meal', reportController.getMidDayMealReport);

export default router;

