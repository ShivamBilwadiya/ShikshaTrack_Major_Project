import * as calendarService from '../services/calendarService.js';
import { sendSuccess, sendError } from '../utils/response.js';

export const getEvents = async (req, res, next) => {
  try {
    const { startDate, endDate, type, isHoliday } = req.query;
    const events = await calendarService.listEvents({
      schoolId: req.user.schoolId,
      startDate,
      endDate,
      type,
      isHoliday,
    });
    return sendSuccess(res, 'Academic events retrieved successfully.', events);
  } catch (err) {
    next(err);
  }
};

export const getEvent = async (req, res, next) => {
  try {
    const event = await calendarService.getEventById(req.params.id, req.user.schoolId);
    return sendSuccess(res, 'Academic event retrieved successfully.', event);
  } catch (err) {
    if (err.statusCode) {
      return sendError(res, err.message, err.statusCode);
    }
    next(err);
  }
};

export const createEvent = async (req, res, next) => {
  try {
    const { title, description, type, startDate, endDate, isHoliday } = req.body;
    const event = await calendarService.createEvent({
      schoolId: req.user.schoolId,
      title,
      description,
      type,
      startDate,
      endDate,
      isHoliday,
      actorId: req.user.id,
    });
    return sendSuccess(res, 'Academic event created successfully.', event, 201);
  } catch (err) {
    if (err.statusCode) {
      return sendError(res, err.message, err.statusCode);
    }
    next(err);
  }
};

export const updateEvent = async (req, res, next) => {
  try {
    const updated = await calendarService.updateEvent(
      req.params.id,
      req.user.schoolId,
      req.body,
      req.user.id
    );
    return sendSuccess(res, 'Academic event updated successfully.', updated);
  } catch (err) {
    if (err.statusCode) {
      return sendError(res, err.message, err.statusCode);
    }
    next(err);
  }
};

export const deleteEvent = async (req, res, next) => {
  try {
    const result = await calendarService.deleteEvent(
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
