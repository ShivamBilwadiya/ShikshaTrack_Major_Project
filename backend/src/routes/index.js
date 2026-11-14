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

export default router;

