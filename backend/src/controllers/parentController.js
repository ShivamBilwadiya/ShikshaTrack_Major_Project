import * as parentService from '../services/parentService.js';
import { sendSuccess, sendError } from '../utils/response.js';

export const createParent = async (req, res, next) => {
  try {
    const result = await parentService.createParentAccount({
      schoolId: req.user.schoolId,
      creatorUserId: req.user.id,
      ...req.body,
    });
    return sendSuccess(res, 'Parent account created successfully.', result, 201);
  } catch (err) {
    if (err.statusCode) {
      return sendError(res, err.message, err.statusCode);
    }
    next(err);
  }
};

export const listParents = async (req, res, next) => {
  try {
    const { search, status, classId, page, limit } = req.query;
    const result = await parentService.listParents({
      schoolId: req.user.schoolId,
      search,
      status,
      classId,
      page,
      limit,
    });
    return sendSuccess(res, 'Parents retrieved successfully.', result);
  } catch (err) {
    if (err.statusCode) {
      return sendError(res, err.message, err.statusCode);
    }
    next(err);
  }
};

export const getParent = async (req, res, next) => {
  try {
    const { id } = req.params;
    // If not admin, ensure parent only requests their own profile
    if (req.user.role === 'PARENT' && req.user.parentId !== id) {
      return sendError(res, 'Forbidden: You can only view your own profile.', 403);
    }

    const result = await parentService.getParentById({
      schoolId: req.user.schoolId,
      parentId: id,
    });
    return sendSuccess(res, 'Parent profile retrieved successfully.', result);
  } catch (err) {
    if (err.statusCode) {
      return sendError(res, err.message, err.statusCode);
    }
    next(err);
  }
};

export const updateParent = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (req.user.role === 'PARENT' && req.user.parentId !== id) {
      return sendError(res, 'Forbidden: You can only update your own profile.', 403);
    }

    const result = await parentService.updateParentProfile({
      schoolId: req.user.schoolId,
      parentId: id,
      data: req.body,
      updatedByUserId: req.user.id,
    });
    return sendSuccess(res, 'Parent profile updated successfully.', result);
  } catch (err) {
    if (err.statusCode) {
      return sendError(res, err.message, err.statusCode);
    }
    next(err);
  }
};

export const linkStudent = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { studentId, relationship, isPrimaryContact, canPickup } = req.body;

    if (!studentId) {
      return sendError(res, 'Student ID is required.', 400);
    }

    const result = await parentService.linkStudentToParent({
      schoolId: req.user.schoolId,
      parentId: id,
      studentId,
      relationship,
      isPrimaryContact,
      canPickup,
      linkedByUserId: req.user.id,
    });
    return sendSuccess(res, 'Student linked to parent successfully.', result);
  } catch (err) {
    if (err.statusCode) {
      return sendError(res, err.message, err.statusCode);
    }
    next(err);
  }
};

export const unlinkStudent = async (req, res, next) => {
  try {
    const { id, studentId } = req.params;
    const result = await parentService.unlinkStudentFromParent({
      schoolId: req.user.schoolId,
      parentId: id,
      studentId,
      unlinkedByUserId: req.user.id,
    });
    return sendSuccess(res, 'Student unlinked from parent successfully.', result);
  } catch (err) {
    if (err.statusCode) {
      return sendError(res, err.message, err.statusCode);
    }
    next(err);
  }
};

export const getMyChildren = async (req, res, next) => {
  try {
    const children = await parentService.getParentLinkedStudents({
      parentUserId: req.user.id,
      schoolId: req.user.schoolId,
    });
    return sendSuccess(res, 'Linked children retrieved successfully.', children);
  } catch (err) {
    if (err.statusCode) {
      return sendError(res, err.message, err.statusCode);
    }
    next(err);
  }
};

export const getDashboardData = async (req, res, next) => {
  try {
    const { studentId } = req.query;
    const parentUserId = req.user.role === 'ADMIN' && req.query.parentUserId
      ? req.query.parentUserId
      : req.user.id;

    const data = await parentService.getParentDashboardData({
      parentUserId,
      schoolId: req.user.schoolId,
      studentId: studentId || null,
    });
    return sendSuccess(res, 'Parent dashboard data retrieved successfully.', data);
  } catch (err) {
    if (err.statusCode) {
      return sendError(res, err.message, err.statusCode);
    }
    next(err);
  }
};

export const submitLeave = async (req, res, next) => {
  try {
    const { studentId, leaveType, startDate, endDate, reason, documentUrl } = req.body;
    const leave = await parentService.submitParentLeaveApplication({
      parentUserId: req.user.id,
      schoolId: req.user.schoolId,
      studentId,
      leaveType,
      startDate,
      endDate,
      reason,
      documentUrl,
    });
    return sendSuccess(res, 'Leave application submitted successfully.', leave, 201);
  } catch (err) {
    if (err.statusCode) {
      return sendError(res, err.message, err.statusCode);
    }
    next(err);
  }
};
