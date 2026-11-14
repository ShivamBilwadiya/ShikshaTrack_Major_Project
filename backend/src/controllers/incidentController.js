import * as incidentService from '../services/incidentService.js';
import { sendSuccess, sendError } from '../utils/response.js';

/**
 * Record a new student incident
 */
export const recordIncident = async (req, res, next) => {
  try {
    const { studentId, classId, title, description, incidentDate, category, severity, isPrivate, actionTaken } =
      req.body;

    if (!studentId || !title || !description) {
      return sendError(res, 'studentId, title, and description are required fields.', 400);
    }

    const incident = await incidentService.recordIncident({
      schoolId: req.user.schoolId,
      studentId,
      classId,
      reportedById: req.user.id,
      title,
      description,
      incidentDate,
      category,
      severity,
      isPrivate: req.user.role === 'ADMIN' ? isPrivate : false,
      actionTaken,
    });

    return sendSuccess(res, 'Student incident recorded successfully.', incident, 201);
  } catch (err) {
    next(err);
  }
};

/**
 * List student incidents with filters
 */
export const listIncidents = async (req, res, next) => {
  try {
    const { classId, studentId, category, severity, status, search, page, limit } = req.query;

    const result = await incidentService.listIncidents({
      schoolId: req.user.schoolId,
      userRole: req.user.role,
      userId: req.user.id,
      classId,
      studentId,
      category,
      severity,
      status,
      search,
      page,
      limit,
    });

    return sendSuccess(res, 'Student incidents retrieved.', result);
  } catch (err) {
    next(err);
  }
};

/**
 * Get incident by ID
 */
export const getIncident = async (req, res, next) => {
  try {
    const incident = await incidentService.getIncidentById(
      req.params.id,
      req.user.schoolId,
      req.user.role,
      req.user.id
    );

    return sendSuccess(res, 'Incident details retrieved.', incident);
  } catch (err) {
    next(err);
  }
};

/**
 * Update incident status and record actions/resolution
 */
export const updateIncidentStatus = async (req, res, next) => {
  try {
    const { status, actionTaken, resolutionNotes, isPrivate } = req.body;

    const updated = await incidentService.updateIncidentStatus({
      incidentId: req.params.id,
      schoolId: req.user.schoolId,
      actorId: req.user.id,
      userRole: req.user.role,
      status,
      actionTaken,
      resolutionNotes,
      isPrivate,
    });

    return sendSuccess(res, 'Incident updated successfully.', updated);
  } catch (err) {
    next(err);
  }
};

/**
 * Add standalone action note to incident timeline
 */
export const addActionHistory = async (req, res, next) => {
  try {
    const { action, notes } = req.body;
    if (!notes) {
      return sendError(res, 'Action notes are required.', 400);
    }

    const history = await incidentService.addIncidentAction({
      incidentId: req.params.id,
      schoolId: req.user.schoolId,
      actorId: req.user.id,
      action,
      notes,
    });

    return sendSuccess(res, 'Action history recorded.', history, 201);
  } catch (err) {
    next(err);
  }
};

/**
 * Get incident summaries and analytics
 */
export const getIncidentSummary = async (req, res, next) => {
  try {
    const { classId, startDate, endDate } = req.query;
    const summary = await incidentService.getIncidentSummary({
      schoolId: req.user.schoolId,
      classId,
      startDate,
      endDate,
    });

    return sendSuccess(res, 'Incident summary statistics retrieved.', summary);
  } catch (err) {
    next(err);
  }
};

/**
 * Export incidents to CSV
 */
export const exportCsv = async (req, res, next) => {
  try {
    const { classId, category, severity, status } = req.query;
    const csvContent = await incidentService.generateIncidentCsv({
      schoolId: req.user.schoolId,
      userRole: req.user.role,
      userId: req.user.id,
      classId,
      category,
      severity,
      status,
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="student_incidents.csv"');
    return res.status(200).send(csvContent);
  } catch (err) {
    next(err);
  }
};
