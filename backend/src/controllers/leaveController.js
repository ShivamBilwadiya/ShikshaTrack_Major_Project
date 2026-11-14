import * as leaveService from '../services/leaveService.js';
import { sendSuccess, sendError } from '../utils/response.js';

/**
 * Apply for student leave
 */
export const applyLeave = async (req, res, next) => {
  try {
    const { studentId, classId, leaveType, startDate, endDate, reason, documentUrl } = req.body;
    if (!studentId || !startDate || !endDate || !reason) {
      return sendError(res, 'studentId, startDate, endDate, and reason are required fields.', 400);
    }

    const leave = await leaveService.applyLeave({
      schoolId: req.user.schoolId,
      studentId,
      classId,
      leaveType,
      startDate,
      endDate,
      reason,
      documentUrl,
      appliedById: req.user.id,
    });

    return sendSuccess(res, 'Leave application submitted successfully.', leave, 201);
  } catch (err) {
    next(err);
  }
};

/**
 * List leaves with filtering and pagination
 */
export const listLeaves = async (req, res, next) => {
  try {
    const { classId, studentId, status, leaveType, startDate, endDate, search, page, limit } = req.query;

    const result = await leaveService.listLeaves({
      schoolId: req.user.schoolId,
      userRole: req.user.role,
      userId: req.user.id,
      classId,
      studentId,
      status,
      leaveType,
      startDate,
      endDate,
      search,
      page,
      limit,
    });

    return sendSuccess(res, 'Leave applications retrieved.', result);
  } catch (err) {
    next(err);
  }
};

/**
 * Get leave application details
 */
export const getLeave = async (req, res, next) => {
  try {
    const leave = await leaveService.getLeaveById(req.params.id, req.user.schoolId);
    return sendSuccess(res, 'Leave details retrieved.', leave);
  } catch (err) {
    next(err);
  }
};

/**
 * Review leave (Approve / Reject)
 */
export const reviewLeave = async (req, res, next) => {
  try {
    const { action, remarks } = req.body;
    if (!action || !remarks) {
      return sendError(res, 'Both decision action ("APPROVED" | "REJECTED") and review remarks are required.', 400);
    }

    const updated = await leaveService.reviewLeave({
      leaveId: req.params.id,
      schoolId: req.user.schoolId,
      reviewerId: req.user.id,
      action,
      remarks,
      userRole: req.user.role,
    });

    return sendSuccess(res, `Leave application ${action.toLowerCase()} successfully.`, updated);
  } catch (err) {
    next(err);
  }
};

/**
 * Bulk review multiple leaves
 */
export const bulkReview = async (req, res, next) => {
  try {
    const { leaveIds, action, remarks } = req.body;
    if (!Array.isArray(leaveIds) || leaveIds.length === 0 || !action || !remarks) {
      return sendError(res, 'leaveIds array, action, and remarks are required.', 400);
    }

    const results = await leaveService.bulkReviewLeaves({
      leaveIds,
      schoolId: req.user.schoolId,
      reviewerId: req.user.id,
      action,
      remarks,
      userRole: req.user.role,
    });

    return sendSuccess(res, 'Bulk review processed.', results);
  } catch (err) {
    next(err);
  }
};

/**
 * Cancel leave application
 */
export const cancelLeave = async (req, res, next) => {
  try {
    const { reason } = req.body;
    const cancelled = await leaveService.cancelLeave({
      leaveId: req.params.id,
      schoolId: req.user.schoolId,
      userId: req.user.id,
      userRole: req.user.role,
      reason,
    });

    return sendSuccess(res, 'Leave application cancelled.', cancelled);
  } catch (err) {
    next(err);
  }
};

/**
 * Get leave summary analytics
 */
export const getLeaveSummary = async (req, res, next) => {
  try {
    const { classId, startDate, endDate } = req.query;
    const summary = await leaveService.getLeaveSummary({
      schoolId: req.user.schoolId,
      classId,
      startDate,
      endDate,
    });

    return sendSuccess(res, 'Leave summary retrieved.', summary);
  } catch (err) {
    next(err);
  }
};

/**
 * Get student leave history
 */
export const getStudentLeaveHistory = async (req, res, next) => {
  try {
    const history = await leaveService.getStudentLeaveHistory(req.params.studentId, req.user.schoolId);
    return sendSuccess(res, 'Student leave history retrieved.', history);
  } catch (err) {
    next(err);
  }
};

/**
 * Get approved leaves for attendance verification
 */
export const getApprovedLeavesForAttendance = async (req, res, next) => {
  try {
    const { classId, date } = req.query;
    if (!classId) {
      return sendError(res, 'classId query parameter is required.', 400);
    }

    const leaves = await leaveService.getApprovedLeavesForAttendance({
      schoolId: req.user.schoolId,
      classId,
      date,
    });

    return sendSuccess(res, 'Approved leaves for attendance retrieved.', leaves);
  } catch (err) {
    next(err);
  }
};

/**
 * Export leave applications to CSV
 */
export const exportCsv = async (req, res, next) => {
  try {
    const { classId, status, leaveType } = req.query;
    const csvContent = await leaveService.generateLeaveCsv({
      schoolId: req.user.schoolId,
      classId,
      status,
      leaveType,
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="student_leaves.csv"');
    return res.status(200).send(csvContent);
  } catch (err) {
    next(err);
  }
};
