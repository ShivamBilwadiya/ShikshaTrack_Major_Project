import * as notificationService from '../services/notificationService.js';
import { sendSuccess, sendError } from '../utils/response.js';

export const getNotifications = async (req, res, next) => {
  try {
    const {
      category,
      status,
      type,
      startDate,
      endDate,
      search,
      page,
      limit,
      sortBy,
      sortOrder,
    } = req.query;

    if (startDate && isNaN(new Date(startDate).getTime())) {
      return sendError(res, 'Invalid start date format. Expected YYYY-MM-DD.', 400);
    }
    if (endDate && isNaN(new Date(endDate).getTime())) {
      return sendError(res, 'Invalid end date format. Expected YYYY-MM-DD.', 400);
    }
    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      return sendError(res, 'Invalid date range: End date cannot be before start date.', 400);
    }

    const data = await notificationService.getNotifications({
      schoolId: req.user.schoolId,
      userId: req.user.role === 'TEACHER' ? req.user.id : req.query.userId,
      userRole: req.user.role,
      category,
      status,
      type,
      startDate,
      endDate,
      search,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      sortBy,
      sortOrder,
    });

    return sendSuccess(res, 'Notifications retrieved successfully.', data);
  } catch (err) {
    if (err.statusCode) {
      return sendError(res, err.message, err.statusCode);
    }
    next(err);
  }
};

export const getNotificationSummary = async (req, res, next) => {
  try {
    const data = await notificationService.getNotificationSummary({
      schoolId: req.user.schoolId,
      userId: req.user.id,
      userRole: req.user.role,
    });
    return sendSuccess(res, 'Notification summary retrieved successfully.', data);
  } catch (err) {
    if (err.statusCode) {
      return sendError(res, err.message, err.statusCode);
    }
    next(err);
  }
};

export const createNotification = async (req, res, next) => {
  try {
    const {
      userId,
      title,
      message,
      category,
      type,
      entityType,
      entityId,
      metadata,
    } = req.body;

    if (!title || !message) {
      return sendError(res, 'Title and message are required fields.', 400);
    }

    const notification = await notificationService.createNotification({
      schoolId: req.user.schoolId,
      userId: userId || null,
      title,
      message,
      category: category || 'INFO',
      type: type || 'GENERAL_ANNOUNCEMENT',
      entityType,
      entityId,
      metadata,
    });

    return sendSuccess(res, 'Notification created successfully.', notification, 201);
  } catch (err) {
    if (err.statusCode) {
      return sendError(res, err.message, err.statusCode);
    }
    next(err);
  }
};

export const markAsRead = async (req, res, next) => {
  try {
    const { id } = req.params;
    const notification = await notificationService.markNotificationAsRead({
      notificationId: id,
      schoolId: req.user.schoolId,
      userId: req.user.id,
      userRole: req.user.role,
    });
    return sendSuccess(res, 'Notification marked as read.', notification);
  } catch (err) {
    if (err.statusCode) {
      return sendError(res, err.message, err.statusCode);
    }
    next(err);
  }
};

export const markAllAsRead = async (req, res, next) => {
  try {
    const { category } = req.body;
    const result = await notificationService.markAllNotificationsAsRead({
      schoolId: req.user.schoolId,
      userId: req.user.id,
      userRole: req.user.role,
      category,
    });
    return sendSuccess(res, 'All matching notifications marked as read.', result);
  } catch (err) {
    if (err.statusCode) {
      return sendError(res, err.message, err.statusCode);
    }
    next(err);
  }
};

export const deleteNotification = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await notificationService.deleteNotification({
      notificationId: id,
      schoolId: req.user.schoolId,
      userId: req.user.id,
      userRole: req.user.role,
    });
    return sendSuccess(res, result.message, result);
  } catch (err) {
    if (err.statusCode) {
      return sendError(res, err.message, err.statusCode);
    }
    next(err);
  }
};

export const generateAlerts = async (req, res, next) => {
  try {
    const result = await notificationService.generateAttendanceAlerts({
      schoolId: req.user.schoolId,
      triggeredByUserId: req.user.id,
    });
    return sendSuccess(res, 'Automated attendance alerts generated.', result);
  } catch (err) {
    if (err.statusCode) {
      return sendError(res, err.message, err.statusCode);
    }
    next(err);
  }
};
