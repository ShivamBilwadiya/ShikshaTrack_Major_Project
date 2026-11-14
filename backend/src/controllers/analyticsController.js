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

/**
 * Get comprehensive student attendance performance and pattern insights
 */
export const getStudentInsights = async (req, res, next) => {
  try {
    const {
      classId,
      threshold,
      status,
      search,
      startDate,
      endDate,
      page,
      limit,
      sortBy,
      sortOrder,
    } = req.query;

    if (threshold !== undefined) {
      const numThreshold = parseFloat(threshold);
      if (isNaN(numThreshold) || numThreshold < 0 || numThreshold > 100) {
        return sendError(res, 'Invalid threshold. Expected a percentage between 0 and 100.', 400);
      }
    }

    if (startDate && isNaN(new Date(startDate).getTime())) {
      return sendError(res, 'Invalid start date format. Expected valid date (YYYY-MM-DD).', 400);
    }

    if (endDate && isNaN(new Date(endDate).getTime())) {
      return sendError(res, 'Invalid end date format. Expected valid date (YYYY-MM-DD).', 400);
    }

    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      return sendError(res, 'Invalid date range: End date cannot be before start date.', 400);
    }

    const parsedThreshold = threshold !== undefined ? parseFloat(threshold) : 75;

    const insights = await analyticsService.getStudentAttendanceInsights({
      schoolId: req.user.schoolId,
      classId,
      threshold: parsedThreshold,
      status: status || 'ALL',
      search,
      startDate,
      endDate,
      page: page !== undefined ? parseInt(page, 10) : undefined,
      limit: limit !== undefined ? parseInt(limit, 10) : undefined,
      sortBy,
      sortOrder,
    });

    return sendSuccess(res, 'Student attendance insights retrieved successfully.', insights);
  } catch (err) {
    if (err.statusCode) {
      return sendError(res, err.message, err.statusCode);
    }
    next(err);
  }
};

/**
 * Get deep attendance analysis for a specific student
 */
export const getStudentDetailInsights = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { threshold } = req.query;

    if (threshold !== undefined) {
      const numThreshold = parseFloat(threshold);
      if (isNaN(numThreshold) || numThreshold < 0 || numThreshold > 100) {
        return sendError(res, 'Invalid threshold. Expected a percentage between 0 and 100.', 400);
      }
    }

    const parsedThreshold = threshold !== undefined ? parseFloat(threshold) : 75;

    const details = await analyticsService.getStudentDetailInsights({
      schoolId: req.user.schoolId,
      studentId: id,
      threshold: parsedThreshold,
    });

    return sendSuccess(res, 'Detailed student attendance insights retrieved successfully.', details);
  } catch (err) {
    if (err.statusCode) {
      return sendError(res, err.message, err.statusCode);
    }
    next(err);
  }
};

/**
 * Get class-wise cohort comparisons and school-wide periodic summaries
 */
export const getCohortSummaries = async (req, res, next) => {
  try {
    const { startDate, endDate, threshold } = req.query;

    if (startDate && isNaN(new Date(startDate).getTime())) {
      return sendError(res, 'Invalid start date format. Expected valid date (YYYY-MM-DD).', 400);
    }

    if (endDate && isNaN(new Date(endDate).getTime())) {
      return sendError(res, 'Invalid end date format. Expected valid date (YYYY-MM-DD).', 400);
    }

    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      return sendError(res, 'Invalid date range: End date cannot be before start date.', 400);
    }

    const parsedThreshold = threshold !== undefined ? parseFloat(threshold) : 75;

    const cohorts = await analyticsService.getCohortSummaries({
      schoolId: req.user.schoolId,
      startDate,
      endDate,
      threshold: parsedThreshold,
    });

    return sendSuccess(res, 'Class cohort attendance summaries retrieved successfully.', cohorts);
  } catch (err) {
    if (err.statusCode) {
      return sendError(res, err.message, err.statusCode);
    }
    next(err);
  }
};

/**
 * Get comprehensive teacher workload, performance, and attendance session completion analytics
 */
export const getTeacherWorkloadAnalytics = async (req, res, next) => {
  try {
    const {
      teacherId,
      classId,
      status,
      startDate,
      endDate,
      search,
      page,
      limit,
      sortBy,
      sortOrder,
    } = req.query;

    // RBAC: Teachers can only view their own performance; Admins can view all
    let effectiveTeacherId = teacherId;
    if (req.user.role === 'TEACHER') {
      if (teacherId && teacherId !== req.user.id) {
        return sendError(
          res,
          'Access denied: Teachers can only view their own workload and performance analytics.',
          403
        );
      }
      effectiveTeacherId = req.user.id;
    }

    if (startDate && isNaN(new Date(startDate).getTime())) {
      return sendError(res, 'Invalid start date format. Expected valid date (YYYY-MM-DD).', 400);
    }

    if (endDate && isNaN(new Date(endDate).getTime())) {
      return sendError(res, 'Invalid end date format. Expected valid date (YYYY-MM-DD).', 400);
    }

    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      return sendError(res, 'Invalid date range: End date cannot be before start date.', 400);
    }

    const data = await analyticsService.getTeacherWorkloadAnalytics({
      schoolId: req.user.schoolId,
      teacherId: effectiveTeacherId,
      classId,
      status,
      startDate,
      endDate,
      search,
      page: page !== undefined ? parseInt(page, 10) : undefined,
      limit: limit !== undefined ? parseInt(limit, 10) : undefined,
      sortBy,
      sortOrder,
    });

    return sendSuccess(res, 'Teacher workload and performance analytics retrieved.', data);
  } catch (err) {
    if (err.statusCode) {
      return sendError(res, err.message, err.statusCode);
    }
    next(err);
  }
};

/**
 * Get detailed workload, trends, and class completion breakdown for single teacher
 */
export const getTeacherDetailAnalytics = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { startDate, endDate } = req.query;

    // RBAC: Teachers can only view their own detailed analytics
    if (req.user.role === 'TEACHER' && id !== req.user.id) {
      return sendError(
        res,
        'Access denied: Teachers can only view their own detailed analytics.',
        403
      );
    }

    if (startDate && isNaN(new Date(startDate).getTime())) {
      return sendError(res, 'Invalid start date format. Expected valid date (YYYY-MM-DD).', 400);
    }

    if (endDate && isNaN(new Date(endDate).getTime())) {
      return sendError(res, 'Invalid end date format. Expected valid date (YYYY-MM-DD).', 400);
    }

    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      return sendError(res, 'Invalid date range: End date cannot be before start date.', 400);
    }

    const data = await analyticsService.getTeacherDetailAnalytics({
      schoolId: req.user.schoolId,
      teacherId: id,
      startDate,
      endDate,
    });

    return sendSuccess(res, 'Detailed teacher performance analytics retrieved.', data);
  } catch (err) {
    if (err.statusCode) {
      return sendError(res, err.message, err.statusCode);
    }
    next(err);
  }
};

/**
 * Get periodic teaching activity trends (weekly and monthly)
 */
export const getTeacherActivityTrends = async (req, res, next) => {
  try {
    const { teacherId, startDate, endDate } = req.query;

    let targetTeacherId = teacherId;
    if (req.user.role === 'TEACHER') {
      targetTeacherId = req.user.id;
    }

    if (startDate && isNaN(new Date(startDate).getTime())) {
      return sendError(res, 'Invalid start date format. Expected valid date (YYYY-MM-DD).', 400);
    }

    if (endDate && isNaN(new Date(endDate).getTime())) {
      return sendError(res, 'Invalid end date format. Expected valid date (YYYY-MM-DD).', 400);
    }

    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      return sendError(res, 'Invalid date range: End date cannot be before start date.', 400);
    }

    const data = await analyticsService.getTeacherActivityTrends({
      schoolId: req.user.schoolId,
      teacherId: targetTeacherId,
      startDate,
      endDate,
    });

    return sendSuccess(res, 'Teacher activity trends retrieved successfully.', data);
  } catch (err) {
    if (err.statusCode) {
      return sendError(res, err.message, err.statusCode);
    }
    next(err);
  }
};
