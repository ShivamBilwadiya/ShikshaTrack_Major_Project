import * as attendanceService from '../services/attendanceService.js';
import { sendSuccess, sendError } from '../utils/response.js';

export const startSession = async (req, res, next) => {
  try {
    const { classId, sessionDate, notes } = req.body;
    if (!classId) {
      return sendError(res, 'Class ID is required to start an attendance session.', 400);
    }

    const session = await attendanceService.startSession({
      classId,
      teacherId: req.user.id,
      schoolId: req.user.schoolId,
      sessionDate,
      notes,
    });

    return sendSuccess(res, 'Attendance session active.', session, 201);
  } catch (err) {
    next(err);
  }
};

export const getSession = async (req, res, next) => {
  try {
    const sessionData = await attendanceService.getSessionDetails(req.params.id, req.user.schoolId);
    return sendSuccess(res, 'Session details retrieved.', sessionData);
  } catch (err) {
    next(err);
  }
};

export const scanQr = async (req, res, next) => {
  try {
    const { sessionId, qrToken, status } = req.body;
    if (!sessionId || !qrToken) {
      return sendError(res, 'Session ID and QR Token are required.', 400);
    }

    const result = await attendanceService.scanQrCode({
      sessionId,
      qrToken,
      schoolId: req.user.schoolId,
      teacherId: req.user.id,
      status: status || 'PRESENT',
    });

    return sendSuccess(res, `Marked ${result.student.name} as ${result.record.status}!`, result);
  } catch (err) {
    return sendError(res, err.message, 400);
  }
};

export const markManual = async (req, res, next) => {
  try {
    const { sessionId, studentId, status, remarks, preventDuplicate } = req.body;
    if (!sessionId || !studentId || !status) {
      return sendError(res, 'Session ID, student ID, and status are required.', 400);
    }

    const record = await attendanceService.markManualRecord({
      sessionId,
      studentId,
      status,
      remarks,
      schoolId: req.user.schoolId,
      actorId: req.user.id,
      method: 'MANUAL',
      preventDuplicate: Boolean(preventDuplicate),
    });

    return sendSuccess(res, 'Attendance marked successfully.', record);
  } catch (err) {
    return sendError(res, err.message, err.statusCode || 400);
  }
};

export const bulkMarkManual = async (req, res, next) => {
  try {
    const { sessionId, records, preventDuplicate } = req.body;
    if (!sessionId || !Array.isArray(records)) {
      return sendError(res, 'Session ID and records array are required.', 400);
    }

    const updated = await attendanceService.bulkMarkManual({
      sessionId,
      records,
      schoolId: req.user.schoolId,
      actorId: req.user.id,
      preventDuplicate: Boolean(preventDuplicate),
    });

    return sendSuccess(res, `Bulk attendance updated for ${updated.length} students.`, updated);
  } catch (err) {
    return sendError(res, err.message, err.statusCode || 400);
  }
};

export const closeSession = async (req, res, next) => {
  try {
    const { finalizeUnmarkedStatus } = req.body;
    const closed = await attendanceService.closeSession({
      sessionId: req.params.id,
      schoolId: req.user.schoolId,
      actorId: req.user.id,
      finalizeUnmarkedStatus: finalizeUnmarkedStatus || null,
    });

    return sendSuccess(res, 'Attendance session closed and finalized.', closed);
  } catch (err) {
    next(err);
  }
};

export const correctRecord = async (req, res, next) => {
  try {
    const { status, remarks, reason } = req.body;
    if (!status || !reason) {
      return sendError(res, 'New status and reason for correction are required.', 400);
    }

    const corrected = await attendanceService.correctAttendanceRecord({
      recordId: req.params.id,
      status,
      remarks,
      reason,
      schoolId: req.user.schoolId,
      actorId: req.user.id,
    });

    return sendSuccess(res, 'Attendance record corrected with audit log.', corrected);
  } catch (err) {
    next(err);
  }
};

export const listSessions = async (req, res, next) => {
  try {
    const { classId, teacherId, date, page, limit } = req.query;
    const result = await attendanceService.listSessions({
      schoolId: req.user.schoolId,
      classId,
      teacherId,
      date,
      page,
      limit,
    });
    return sendSuccess(res, 'Sessions retrieved.', result);
  } catch (err) {
    next(err);
  }
};

