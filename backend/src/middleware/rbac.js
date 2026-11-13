import { sendError } from '../utils/response.js';

/**
 * Restrict route to specific roles (e.g. ADMIN, TEACHER)
 */
export const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return sendError(res, 'Authentication required.', 401);
    }

    if (!allowedRoles.includes(req.user.role)) {
      return sendError(
        res,
        `Forbidden: Role '${req.user.role}' is not authorized to access this resource.`,
        403
      );
    }

    next();
  };
};

/**
 * Ensure a teacher can only access classes assigned to them.
 * Admins are permitted for all classes.
 */
export const requireClassAccess = (paramName = 'classId') => {
  return (req, res, next) => {
    if (!req.user) {
      return sendError(res, 'Authentication required.', 401);
    }

    if (req.user.role === 'ADMIN') {
      return next();
    }

    const targetClassId = req.params[paramName] || req.body[paramName] || req.query[paramName];

    if (!targetClassId) {
      return next();
    }

    if (!req.user.assignedClasses.includes(targetClassId)) {
      return sendError(
        res,
        'Access denied: You are not assigned to manage attendance for this class.',
        403
      );
    }

    next();
  };
};

