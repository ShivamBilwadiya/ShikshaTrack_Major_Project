import * as analyticsService from '../services/analyticsService.js';
import { sendSuccess, sendError } from '../utils/response.js';

export const getAdminStats = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    if (startDate && isNaN(new Date(startDate).getTime())) {
      return sendError(res, 'Invalid start date format. Expected valid date (YYYY-MM-DD).', 400);
    }

    if (endDate && isNaN(new Date(endDate).getTime())) {
      return sendError(res, 'Invalid end date format. Expected valid date (YYYY-MM-DD).', 400);
    }

    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      return sendError(res, 'Invalid date range: End date cannot be before start date.', 400);
    }

    const stats = await analyticsService.getAdminDashboardStats(req.user.schoolId, { startDate, endDate });
    return sendSuccess(res, 'Admin dashboard analytics retrieved.', stats);
  } catch (err) {
    next(err);
  }
};

export const getTeacherStats = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    if (startDate && isNaN(new Date(startDate).getTime())) {
      return sendError(res, 'Invalid start date format. Expected valid date (YYYY-MM-DD).', 400);
    }

    if (endDate && isNaN(new Date(endDate).getTime())) {
      return sendError(res, 'Invalid end date format. Expected valid date (YYYY-MM-DD).', 400);
    }

    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      return sendError(res, 'Invalid date range: End date cannot be before start date.', 400);
    }

    const stats = await analyticsService.getTeacherDashboardStats(req.user.id, req.user.schoolId, { startDate, endDate });
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

