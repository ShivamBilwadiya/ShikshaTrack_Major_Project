import * as timetableService from '../services/timetableService.js';
import { sendSuccess, sendError } from '../utils/response.js';

export const getTimetable = async (req, res, next) => {
  try {
    const { classId, teacherId, dayOfWeek, academicYear, subject, search } = req.query;
    const entries = await timetableService.listTimetableEntries({
      schoolId: req.user.schoolId,
      classId,
      teacherId,
      dayOfWeek,
      academicYear,
      subject,
      search,
    });
    return sendSuccess(res, 'Timetable entries retrieved successfully.', entries);
  } catch (err) {
    next(err);
  }
};

export const getWeeklyGrid = async (req, res, next) => {
  try {
    const { classId, teacherId, academicYear } = req.query;
    const gridData = await timetableService.getWeeklyTimetableGrid({
      schoolId: req.user.schoolId,
      classId,
      teacherId,
      academicYear,
    });
    return sendSuccess(res, 'Weekly timetable grid retrieved successfully.', gridData);
  } catch (err) {
    next(err);
  }
};

export const getMySchedule = async (req, res, next) => {
  try {
    const gridData = await timetableService.getWeeklyTimetableGrid({
      schoolId: req.user.schoolId,
      teacherId: req.user.id,
    });
    return sendSuccess(res, 'Personal teaching schedule retrieved successfully.', gridData);
  } catch (err) {
    next(err);
  }
};

export const getTimetableEntry = async (req, res, next) => {
  try {
    const entry = await timetableService.getTimetableEntryById(req.params.id, req.user.schoolId);
    return sendSuccess(res, 'Timetable entry retrieved successfully.', entry);
  } catch (err) {
    if (err.statusCode) {
      return sendError(res, err.message, err.statusCode);
    }
    next(err);
  }
};

export const createTimetableEntry = async (req, res, next) => {
  try {
    const {
      classId,
      teacherId,
      subject,
      dayOfWeek,
      startTime,
      endTime,
      roomNumber,
      academicYear,
      notes,
    } = req.body;

    const entry = await timetableService.createTimetableEntry({
      schoolId: req.user.schoolId,
      classId,
      teacherId,
      subject,
      dayOfWeek,
      startTime,
      endTime,
      roomNumber,
      academicYear,
      notes,
      actorId: req.user.id,
    });

    return sendSuccess(res, 'Timetable entry created successfully.', entry, 201);
  } catch (err) {
    if (err.statusCode === 409) {
      return res.status(409).json({
        success: false,
        message: err.message,
        conflicts: err.conflicts,
      });
    }
    if (err.statusCode) {
      return sendError(res, err.message, err.statusCode);
    }
    next(err);
  }
};

export const updateTimetableEntry = async (req, res, next) => {
  try {
    const updated = await timetableService.updateTimetableEntry(
      req.params.id,
      req.user.schoolId,
      req.body,
      req.user.id
    );
    return sendSuccess(res, 'Timetable entry updated successfully.', updated);
  } catch (err) {
    if (err.statusCode === 409) {
      return res.status(409).json({
        success: false,
        message: err.message,
        conflicts: err.conflicts,
      });
    }
    if (err.statusCode) {
      return sendError(res, err.message, err.statusCode);
    }
    next(err);
  }
};

export const deleteTimetableEntry = async (req, res, next) => {
  try {
    const result = await timetableService.deleteTimetableEntry(
      req.params.id,
      req.user.schoolId,
      req.user.id
    );
    return sendSuccess(res, result.message, { id: result.id });
  } catch (err) {
    if (err.statusCode) {
      return sendError(res, err.message, err.statusCode);
    }
    next(err);
  }
};

export const validateSlot = async (req, res, next) => {
  try {
    const { classId, teacherId, dayOfWeek, startTime, endTime, roomNumber, excludeEntryId } =
      req.body;

    const validation = await timetableService.checkSlotConflict({
      schoolId: req.user.schoolId,
      classId,
      teacherId,
      dayOfWeek,
      startTime,
      endTime,
      roomNumber,
      excludeEntryId,
    });

    return sendSuccess(res, 'Slot conflict validation completed.', validation);
  } catch (err) {
    next(err);
  }
};
