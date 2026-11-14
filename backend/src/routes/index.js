import { Router } from 'express';
import authRoutes from './authRoutes.js';
import classRoutes from './classRoutes.js';
import teacherRoutes from './teacherRoutes.js';
import studentRoutes from './studentRoutes.js';
import attendanceRoutes from './attendanceRoutes.js';
import reportRoutes from './reportRoutes.js';
import analyticsRoutes from './analyticsRoutes.js';
import aiRoutes from './aiRoutes.js';
import syncRoutes from './syncRoutes.js';
import notificationRoutes from './notificationRoutes.js';
import timetableRoutes from './timetableRoutes.js';
import calendarRoutes from './calendarRoutes.js';
import examRoutes from './examRoutes.js';
import leaveRoutes from './leaveRoutes.js';
import incidentRoutes from './incidentRoutes.js';
import feeRoutes from './feeRoutes.js';
import parentRoutes from './parentRoutes.js';
import communicationRoutes from './communicationRoutes.js';

const router = Router();

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    project: 'ShikshaTrack',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// Resource Routers under /api/v1
router.use('/auth', authRoutes);
router.use('/classes', classRoutes);
router.use('/teachers', teacherRoutes);
router.use('/students', studentRoutes);
router.use('/attendance', attendanceRoutes);
router.use('/reports', reportRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/ai', aiRoutes);
router.use('/sync', syncRoutes);
router.use('/notifications', notificationRoutes);
router.use('/timetable', timetableRoutes);
router.use('/calendar', calendarRoutes);
router.use('/exams', examRoutes);
router.use('/leaves', leaveRoutes);
router.use('/incidents', incidentRoutes);
router.use('/fees', feeRoutes);
router.use('/parents', parentRoutes);
router.use('/communication', communicationRoutes);

export default router;

