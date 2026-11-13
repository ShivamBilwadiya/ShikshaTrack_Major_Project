import * as aiService from '../services/aiService.js';
import { sendSuccess, sendError } from '../utils/response.js';

export const getInsights = async (req, res, next) => {
  try {
    const insights = await aiService.generateAttendanceInsights(req.user.schoolId);
    return sendSuccess(res, 'AI Attendance Insights generated.', insights);
  } catch (err) {
    next(err);
  }
};

export const askAssistant = async (req, res, next) => {
  try {
    const { query } = req.body;
    if (!query || !query.trim()) {
      return sendError(res, 'A natural language query is required.', 400);
    }

    const answer = await aiService.askShikshaTrack({
      query,
      schoolId: req.user.schoolId,
    });

    return sendSuccess(res, 'Response generated from verified database queries.', answer);
  } catch (err) {
    next(err);
  }
};

export const generateReport = async (req, res, next) => {
  try {
    const { date } = req.body;
    const report = await aiService.generateAdministrativeReport({
      schoolId: req.user.schoolId,
      date,
    });

    return sendSuccess(res, 'Administrative attendance report generated.', report);
  } catch (err) {
    next(err);
  }
};

