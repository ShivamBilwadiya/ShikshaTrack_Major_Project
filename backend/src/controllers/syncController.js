import * as syncService from '../services/syncService.js';
import { sendSuccess, sendError } from '../utils/response.js';

export const downloadRoster = async (req, res, next) => {
  try {
    const { classId } = req.params;
    const roster = await syncService.downloadRoster({
      classId,
      schoolId: req.user.schoolId,
      teacherId: req.user.id,
    });
    return sendSuccess(res, 'Offline class roster downloaded successfully.', roster);
  } catch (err) {
    if (err.statusCode) {
      return sendError(res, err.message, err.statusCode);
    }
    next(err);
  }
};

export const syncBatch = async (req, res, next) => {
  try {
    const { events } = req.body;
    if (!events || !Array.isArray(events)) {
      return sendError(res, 'An array of offline attendance events is required.', 400);
    }

    const syncResult = await syncService.syncBatch({
      schoolId: req.user.schoolId,
      teacherId: req.user.id,
      events,
    });

    return sendSuccess(res, 'Offline events synchronized successfully.', syncResult);
  } catch (err) {
    if (err.statusCode) {
      return sendError(res, err.message, err.statusCode);
    }
    next(err);
  }
};

export const getSyncStatus = async (req, res, next) => {
  try {
    const status = await syncService.getSyncStatus({
      schoolId: req.user.schoolId,
      teacherId: req.user.role === 'TEACHER' ? req.user.id : null,
    });
    return sendSuccess(res, 'Sync engine status retrieved successfully.', status);
  } catch (err) {
    if (err.statusCode) {
      return sendError(res, err.message, err.statusCode);
    }
    next(err);
  }
};

export const getConflicts = async (req, res, next) => {
  try {
    const { page, limit } = req.query;
    const conflicts = await syncService.getSyncConflicts({
      schoolId: req.user.schoolId,
      page,
      limit,
    });
    return sendSuccess(res, 'Sync conflicts retrieved successfully.', conflicts);
  } catch (err) {
    if (err.statusCode) {
      return sendError(res, err.message, err.statusCode);
    }
    next(err);
  }
};

export const resolveConflict = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { strategy } = req.body;

    const result = await syncService.resolveSyncConflict({
      conflictId: id,
      schoolId: req.user.schoolId,
      resolvedById: req.user.id,
      strategy: strategy || 'KEEP_SERVER',
    });
    return sendSuccess(res, 'Sync conflict resolved successfully.', result);
  } catch (err) {
    if (err.statusCode) {
      return sendError(res, err.message, err.statusCode);
    }
    next(err);
  }
};

export const retryFailed = async (req, res, next) => {
  try {
    const result = await syncService.retryFailedOperations({
      schoolId: req.user.schoolId,
      teacherId: req.user.role === 'TEACHER' ? req.user.id : null,
    });
    return sendSuccess(res, 'Failed operations retry triggered successfully.', result);
  } catch (err) {
    if (err.statusCode) {
      return sendError(res, err.message, err.statusCode);
    }
    next(err);
  }
};
