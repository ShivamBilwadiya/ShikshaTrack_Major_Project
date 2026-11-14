import * as communicationService from '../services/communicationService.js';
import { sendSuccess, sendError } from '../utils/response.js';

// ==================== ANNOUNCEMENTS ====================

export const createAnnouncement = async (req, res, next) => {
  try {
    const result = await communicationService.createAnnouncement({
      schoolId: req.user.schoolId,
      authorId: req.user.id,
      ...req.body,
    });
    return sendSuccess(res, 'Announcement created and published successfully.', result, 201);
  } catch (err) {
    if (err.statusCode) {
      return sendError(res, err.message, err.statusCode);
    }
    next(err);
  }
};

export const listAnnouncements = async (req, res, next) => {
  try {
    const { category, search, page, limit } = req.query;
    const result = await communicationService.listAnnouncements({
      schoolId: req.user.schoolId,
      userId: req.user.id,
      userRole: req.user.role,
      category,
      search,
      page,
      limit,
    });
    return sendSuccess(res, 'Announcements retrieved successfully.', result);
  } catch (err) {
    if (err.statusCode) {
      return sendError(res, err.message, err.statusCode);
    }
    next(err);
  }
};

export const getAnnouncement = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await communicationService.getAnnouncementById({
      schoolId: req.user.schoolId,
      announcementId: id,
      userId: req.user.id,
    });
    return sendSuccess(res, 'Announcement retrieved successfully.', result);
  } catch (err) {
    if (err.statusCode) {
      return sendError(res, err.message, err.statusCode);
    }
    next(err);
  }
};

export const updateAnnouncement = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await communicationService.updateAnnouncement({
      schoolId: req.user.schoolId,
      announcementId: id,
      userId: req.user.id,
      userRole: req.user.role,
      data: req.body,
    });
    return sendSuccess(res, 'Announcement updated successfully.', result);
  } catch (err) {
    if (err.statusCode) {
      return sendError(res, err.message, err.statusCode);
    }
    next(err);
  }
};

export const deleteAnnouncement = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await communicationService.deleteAnnouncement({
      schoolId: req.user.schoolId,
      announcementId: id,
      userId: req.user.id,
      userRole: req.user.role,
    });
    return sendSuccess(res, 'Announcement deleted successfully.', result);
  } catch (err) {
    if (err.statusCode) {
      return sendError(res, err.message, err.statusCode);
    }
    next(err);
  }
};

export const markAnnouncementRead = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await communicationService.markAnnouncementRead({
      announcementId: id,
      userId: req.user.id,
    });
    return sendSuccess(res, 'Announcement marked as read.', result);
  } catch (err) {
    if (err.statusCode) {
      return sendError(res, err.message, err.statusCode);
    }
    next(err);
  }
};

// ==================== DIRECT MESSAGES ====================

export const sendMessage = async (req, res, next) => {
  try {
    const { receiverId, subject, content, category, studentId, attachmentUrl, threadId } = req.body;
    const result = await communicationService.sendMessage({
      schoolId: req.user.schoolId,
      senderId: req.user.id,
      receiverId,
      subject,
      content,
      category,
      studentId,
      attachmentUrl,
      threadId,
    });
    return sendSuccess(res, 'Message sent successfully.', result, 201);
  } catch (err) {
    if (err.statusCode) {
      return sendError(res, err.message, err.statusCode);
    }
    next(err);
  }
};

export const listMessages = async (req, res, next) => {
  try {
    const { box, category, isRead, search, page, limit } = req.query;
    const result = await communicationService.listMessages({
      schoolId: req.user.schoolId,
      userId: req.user.id,
      box,
      category,
      isRead,
      search,
      page,
      limit,
    });
    return sendSuccess(res, 'Messages retrieved successfully.', result);
  } catch (err) {
    if (err.statusCode) {
      return sendError(res, err.message, err.statusCode);
    }
    next(err);
  }
};

export const getMessageThread = async (req, res, next) => {
  try {
    const { threadId } = req.params;
    const result = await communicationService.getMessageThread({
      schoolId: req.user.schoolId,
      threadId,
      userId: req.user.id,
    });
    return sendSuccess(res, 'Message thread retrieved successfully.', result);
  } catch (err) {
    if (err.statusCode) {
      return sendError(res, err.message, err.statusCode);
    }
    next(err);
  }
};

export const replyToMessage = async (req, res, next) => {
  try {
    const { threadId } = req.params;
    const { content, attachmentUrl } = req.body;
    const result = await communicationService.replyToMessageThread({
      schoolId: req.user.schoolId,
      threadId,
      senderId: req.user.id,
      content,
      attachmentUrl,
    });
    return sendSuccess(res, 'Reply sent successfully.', result, 201);
  } catch (err) {
    if (err.statusCode) {
      return sendError(res, err.message, err.statusCode);
    }
    next(err);
  }
};

export const markMessageRead = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await communicationService.markMessageRead({
      schoolId: req.user.schoolId,
      messageId: id,
      userId: req.user.id,
    });
    return sendSuccess(res, 'Message marked as read.', result);
  } catch (err) {
    if (err.statusCode) {
      return sendError(res, err.message, err.statusCode);
    }
    next(err);
  }
};

export const getUnreadCount = async (req, res, next) => {
  try {
    const result = await communicationService.getUnreadMessageCount({
      schoolId: req.user.schoolId,
      userId: req.user.id,
    });
    return sendSuccess(res, 'Unread message count retrieved.', result);
  } catch (err) {
    if (err.statusCode) {
      return sendError(res, err.message, err.statusCode);
    }
    next(err);
  }
};
