import * as teacherService from '../services/teacherService.js';
import { sendSuccess, sendError } from '../utils/response.js';

/**
 * List teachers with optional search, filtering, and pagination
 */
export const getTeachers = async (req, res, next) => {
  try {
    const { search, status, classId, page, limit, sortBy, sortOrder } = req.query;
    const teachers = await teacherService.listTeachers({
      schoolId: req.user.schoolId,
      search,
      status,
      classId,
      page,
      limit,
      sortBy,
      sortOrder,
    });
    return sendSuccess(res, 'Teachers retrieved successfully.', teachers);
  } catch (err) {
    if (err.statusCode) {
      return sendError(res, err.message, err.statusCode);
    }
    next(err);
  }
};

/**
 * Get teacher by ID
 */
export const getTeacher = async (req, res, next) => {
  try {
    const teacher = await teacherService.getTeacherById(req.params.id, req.user.schoolId);
    return sendSuccess(res, 'Teacher retrieved successfully.', teacher);
  } catch (err) {
    if (err.statusCode) {
      return sendError(res, err.message, err.statusCode);
    }
    next(err);
  }
};

/**
 * Create a new teacher
 */
export const createTeacher = async (req, res, next) => {
  try {
    const { name, email, password, assignedClassIds, assignments } = req.body;

    const teacher = await teacherService.createTeacher({
      name,
      email,
      password,
      schoolId: req.user.schoolId,
      assignedClassIds: assignedClassIds || [],
      assignments: assignments || [],
      actorId: req.user.id,
    });

    return sendSuccess(res, 'Teacher created successfully.', teacher, 201);
  } catch (err) {
    if (err.statusCode) {
      return sendError(res, err.message, err.statusCode);
    }
    next(err);
  }
};

/**
 * Update teacher profile
 */
export const updateTeacher = async (req, res, next) => {
  try {
    const { name, email, password, active } = req.body;
    const updated = await teacherService.updateTeacher(
      req.params.id,
      req.user.schoolId,
      { name, email, password, active },
      req.user.id
    );
    return sendSuccess(res, 'Teacher profile updated successfully.', updated);
  } catch (err) {
    if (err.statusCode) {
      return sendError(res, err.message, err.statusCode);
    }
    next(err);
  }
};

/**
 * Delete or safely deactivate a teacher
 */
export const deleteTeacher = async (req, res, next) => {
  try {
    const result = await teacherService.deleteTeacher(
      req.params.id,
      req.user.schoolId,
      req.user.id
    );
    return sendSuccess(res, result.message, result);
  } catch (err) {
    if (err.statusCode) {
      return sendError(res, err.message, err.statusCode);
    }
    next(err);
  }
};

/**
 * Bulk update/replace teacher class assignments
 */
export const updateTeacherAssignments = async (req, res, next) => {
  try {
    const { classIds, assignments } = req.body;
    const payload = assignments || classIds || [];
    const updated = await teacherService.updateTeacherAssignments(
      req.params.id,
      req.user.schoolId,
      payload,
      req.user.id
    );
    return sendSuccess(res, 'Teacher class assignments updated successfully.', updated);
  } catch (err) {
    if (err.statusCode) {
      return sendError(res, err.message, err.statusCode);
    }
    next(err);
  }
};

/**
 * Add a single class assignment to teacher
 */
export const addTeacherAssignment = async (req, res, next) => {
  try {
    const { classId, isClassTeacher } = req.body;
    const updated = await teacherService.addTeacherAssignment(
      req.params.id,
      req.user.schoolId,
      { classId, isClassTeacher },
      req.user.id
    );
    return sendSuccess(res, 'Class assigned to teacher successfully.', updated, 201);
  } catch (err) {
    if (err.statusCode) {
      return sendError(res, err.message, err.statusCode);
    }
    next(err);
  }
};

/**
 * Remove a single class assignment from teacher
 */
export const removeTeacherAssignment = async (req, res, next) => {
  try {
    const updated = await teacherService.removeTeacherAssignment(
      req.params.id,
      req.user.schoolId,
      req.params.classId,
      req.user.id
    );
    return sendSuccess(res, 'Class unassigned from teacher successfully.', updated);
  } catch (err) {
    if (err.statusCode) {
      return sendError(res, err.message, err.statusCode);
    }
    next(err);
  }
};

/**
 * Get assigned classes and workload for a teacher
 */
export const getTeacherClasses = async (req, res, next) => {
  try {
    const workload = await teacherService.getTeacherClasses(req.params.id, req.user.schoolId);
    return sendSuccess(res, 'Teacher classes and workload retrieved successfully.', workload);
  } catch (err) {
    if (err.statusCode) {
      return sendError(res, err.message, err.statusCode);
    }
    next(err);
  }
};

/**
 * Toggle teacher active status
 */
export const toggleTeacherStatus = async (req, res, next) => {
  try {
    const updated = await teacherService.toggleTeacherStatus(
      req.params.id,
      req.user.schoolId,
      req.user.id
    );
    return sendSuccess(
      res,
      `Teacher status updated to ${updated.active ? 'active' : 'inactive'}.`,
      updated
    );
  } catch (err) {
    if (err.statusCode) {
      return sendError(res, err.message, err.statusCode);
    }
    next(err);
  }
};
