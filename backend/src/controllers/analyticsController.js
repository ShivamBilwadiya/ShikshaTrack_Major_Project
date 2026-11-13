import * as analyticsService from '../services/analyticsService.js';
import { sendSuccess } from '../utils/response.js';

export const getAdminStats = async (req, res, next) => {
  try {
    const stats = await analyticsService.getAdminDashboardStats(req.user.schoolId);
    return sendSuccess(res, 'Admin dashboard analytics retrieved.', stats);
  } catch (err) {
    next(err);
  }
};

export const getTeacherStats = async (req, res, next) => {
  try {
    const stats = await analyticsService.getTeacherDashboardStats(req.user.id, req.user.schoolId);
    return sendSuccess(res, 'Teacher dashboard statistics retrieved.', stats);
  } catch (err) {
    next(err);
  }
};

export const getAnomalies = async (req, res, next) => {
  try {
    const anomalies = await analyticsService.detectAttendanceAnomalies(req.user.schoolId);
    return sendSuccess(res, 'Attendance anomalies detected via statistical rules.', anomalies);
  } catch (err) {
    next(err);
  }
};

