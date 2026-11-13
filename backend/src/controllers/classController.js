import * as classService from '../services/classService.js';
import { sendSuccess, sendError } from '../utils/response.js';

export const getClasses = async (req, res, next) => {
  try {
    const classes = await classService.listClasses(req.user.schoolId);
    return sendSuccess(res, 'Classes retrieved successfully.', classes);
  } catch (err) {
    next(err);
  }
};

export const getClass = async (req, res, next) => {
  try {
    const cls = await classService.getClassById(req.params.id, req.user.schoolId);
    return sendSuccess(res, 'Class details retrieved successfully.', cls);
  } catch (err) {
    next(err);
  }
};

export const createClass = async (req, res, next) => {
  try {
    const { name, section, academicYear } = req.body;
    if (!name || !section || !academicYear) {
      return sendError(res, 'Name, section, and academic year are required.', 400);
    }

    const cls = await classService.createClass({
      name,
      section,
      academicYear,
      schoolId: req.user.schoolId,
      actorId: req.user.id,
    });

    return sendSuccess(res, 'Class created successfully.', cls, 201);
  } catch (err) {
    next(err);
  }
};

export const updateClass = async (req, res, next) => {
  try {
    const { name, section, academicYear } = req.body;
    const cls = await classService.updateClass(req.params.id, req.user.schoolId, {
      name,
      section,
      academicYear,
      actorId: req.user.id,
    });
    return sendSuccess(res, 'Class updated successfully.', cls);
  } catch (err) {
    next(err);
  }
};

export const deleteClass = async (req, res, next) => {
  try {
    const result = await classService.deleteClass(req.params.id, req.user.schoolId, req.user.id);
    return sendSuccess(res, result.message);
  } catch (err) {
    next(err);
  }
};

