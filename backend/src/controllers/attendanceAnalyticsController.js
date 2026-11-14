import * as analyticsService from '../services/attendanceAnalyticsService.js';
import { sendSuccess, sendError } from '../utils/response.js';

/**
 * Overall Attendance Overview & Key Metrics
 */
export const getOverview = async (req, res, next) => {
  try {
    const { classId, startDate, endDate } = req.query;
    const overview = await analyticsService.getAttendanceOverview({
      schoolId: req.user.schoolId,
      classId,
      startDate,
      endDate,
    });
    return sendSuccess(res, 'Attendance overview retrieved.', overview);
  } catch (err) {
    next(err);
  }
};

/**
 * Attendance Trends by Interval (daily, weekly, monthly)
 */
export const getTrends = async (req, res, next) => {
  try {
    const { classId, startDate, endDate, interval } = req.query;
    const trends = await analyticsService.getAttendanceTrends({
      schoolId: req.user.schoolId,
      classId,
      startDate,
      endDate,
      interval,
    });
    return sendSuccess(res, 'Attendance trends retrieved.', trends);
  } catch (err) {
    next(err);
  }
};

/**
 * Class-wise Attendance Comparison
 */
export const getClassComparison = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const comparison = await analyticsService.getClassAttendanceComparison({
      schoolId: req.user.schoolId,
      startDate,
      endDate,
    });
    return sendSuccess(res, 'Class attendance comparisons retrieved.', comparison);
  } catch (err) {
    next(err);
  }
};

/**
 * Student-wise Attendance Summaries
 */
export const getStudentSummaries = async (req, res, next) => {
  try {
    const { classId, startDate, endDate, search, page, limit } = req.query;
    const summaries = await analyticsService.getStudentAttendanceSummaries({
      schoolId: req.user.schoolId,
      classId,
      startDate,
      endDate,
      search,
      page,
      limit,
    });
    return sendSuccess(res, 'Student attendance summaries retrieved.', summaries);
  } catch (err) {
    next(err);
  }
};

/**
 * At-Risk Students Below Configurable Threshold
 */
export const getAtRisk = async (req, res, next) => {
  try {
    const { classId, threshold, minConsecutive, startDate, endDate } = req.query;
    const atRisk = await analyticsService.getAtRiskStudents({
      schoolId: req.user.schoolId,
      classId,
      threshold,
      minConsecutive,
      startDate,
      endDate,
    });
    return sendSuccess(res, 'At-risk attendance analytics retrieved.', atRisk);
  } catch (err) {
    next(err);
  }
};

/**
 * Export Attendance Analytics to CSV
 */
export const exportCsv = async (req, res, next) => {
  try {
    const { classId, type, startDate, endDate } = req.query;
    const csv = await analyticsService.generateAttendanceCsv({
      schoolId: req.user.schoolId,
      classId,
      type: type || 'students',
      startDate,
      endDate,
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="attendance_${type || 'analytics'}.csv"`);
    return res.status(200).send(csv);
  } catch (err) {
    next(err);
  }
};
