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
    next(err);
  }
};

