import * as teacherService from '../services/teacherService.js';
import { sendSuccess, sendError } from '../utils/response.js';

export const getTeachers = async (req, res, next) => {
  try {
    const teachers = await teacherService.listTeachers(req.user.schoolId);
    return sendSuccess(res, 'Teachers retrieved successfully.', teachers);
  } catch (err) {
    next(err);
  }
};

export const getTeacher = async (req, res, next) => {
  try {
    const teacher = await teacherService.getTeacherById(req.params.id, req.user.schoolId);
    return sendSuccess(res, 'Teacher retrieved successfully.', teacher);
  } catch (err) {
    next(err);
  }
};

export const createTeacher = async (req, res, next) => {
  try {
    const { name, email, password, assignedClassIds } = req.body;
    if (!name || !email) {
      return sendError(res, 'Teacher name and email are required.', 400);
    }

    const teacher = await teacherService.createTeacher({
      name,
      email,
      password,
      schoolId: req.user.schoolId,
      assignedClassIds: assignedClassIds || [],
      actorId: req.user.id,
    });

    return sendSuccess(res, 'Teacher created successfully.', teacher, 201);
  } catch (err) {
    next(err);
  }
};

export const updateTeacherAssignments = async (req, res, next) => {
  try {
    const { classIds } = req.body;
    const updated = await teacherService.updateTeacherAssignments(
      req.params.id,
      req.user.schoolId,
      classIds || [],
      req.user.id
    );
    return sendSuccess(res, 'Teacher class assignments updated successfully.', updated);
  } catch (err) {
    next(err);
  }
};

export const toggleTeacherStatus = async (req, res, next) => {
  try {
    const updated = await teacherService.toggleTeacherStatus(req.params.id, req.user.schoolId, req.user.id);
    return sendSuccess(res, `Teacher status updated to ${updated.active ? 'active' : 'inactive'}.`, updated);
  } catch (err) {
    next(err);
  }
};

