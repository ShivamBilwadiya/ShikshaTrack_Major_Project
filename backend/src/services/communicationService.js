import prisma from '../config/db.js';
import { createNotification } from './notificationService.js';

const VALID_ANNOUNCEMENT_CATEGORIES = ['GENERAL', 'ACADEMIC', 'ATTENDANCE', 'FEES', 'EVENTS', 'URGENT'];
const VALID_AUDIENCES = ['ALL', 'PARENTS', 'TEACHERS', 'CLASS'];
const VALID_MESSAGE_CATEGORIES = ['GENERAL', 'ACADEMIC', 'ATTENDANCE', 'FEES', 'URGENT'];

/**
 * Create a new school or class announcement
 */
export const createAnnouncement = async ({
  schoolId,
  authorId,
  title,
  content,
  category = 'GENERAL',
  priority = 'NORMAL',
  targetAudience = 'ALL',
  classId = null,
  attachmentUrl = null,
  scheduledFor = null,
  expiresAt = null,
}) => {
  if (!schoolId || !authorId) {
    const err = new Error('School ID and Author ID are required.');
    err.statusCode = 400;
    throw err;
  }

  if (!title || !content) {
    const err = new Error('Announcement title and content are required.');
    err.statusCode = 400;
    throw err;
  }

  const normalizedCategory = String(category).toUpperCase();
  if (!VALID_ANNOUNCEMENT_CATEGORIES.includes(normalizedCategory)) {
    const err = new Error(`Invalid announcement category. Must be one of: ${VALID_ANNOUNCEMENT_CATEGORIES.join(', ')}`);
    err.statusCode = 400;
    throw err;
  }

  const normalizedAudience = String(targetAudience).toUpperCase();
  if (!VALID_AUDIENCES.includes(normalizedAudience)) {
    const err = new Error(`Invalid target audience. Must be one of: ${VALID_AUDIENCES.join(', ')}`);
    err.statusCode = 400;
    throw err;
  }

  if (normalizedAudience === 'CLASS' && !classId) {
    const err = new Error('Class ID is required when target audience is CLASS.');
    err.statusCode = 400;
    throw err;
  }

  if (classId) {
    const classRecord = await prisma.class.findFirst({
      where: { id: classId, schoolId },
    });
    if (!classRecord) {
      const err = new Error('Specified class not found in this school.');
      err.statusCode = 404;
      throw err;
    }
  }

  const announcement = await prisma.schoolAnnouncement.create({
    data: {
      schoolId,
      authorId,
      title: title.trim(),
      content: content.trim(),
      category: normalizedCategory,
      priority: priority ? String(priority).toUpperCase() : 'NORMAL',
      targetAudience: normalizedAudience,
      classId: normalizedAudience === 'CLASS' ? classId : null,
      attachmentUrl: attachmentUrl || null,
      scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      isPublished: true,
      publishedAt: new Date(),
    },
    include: {
      author: {
        select: { id: true, name: true, role: true },
      },
      class: {
        select: { id: true, name: true, section: true },
      },
    },
  });

  // Automated notification dispatch
  try {
    const notifCategory = normalizedCategory === 'URGENT' ? 'URGENT' : 'INFO';
    if (normalizedAudience === 'ALL') {
      await createNotification({
        schoolId,
        title: `Announcement: ${title}`,
        message: content.length > 120 ? `${content.substring(0, 117)}...` : content,
        category: notifCategory,
        type: 'GENERAL_ANNOUNCEMENT',
        entityType: 'ANNOUNCEMENT',
        entityId: announcement.id,
      });
    } else if (normalizedAudience === 'PARENTS') {
      // Find all parents in the school
      const parents = await prisma.parent.findMany({
        where: { schoolId, status: 'ACTIVE' },
        select: { userId: true },
      });
      await Promise.all(
        parents.map((p) =>
          createNotification({
            schoolId,
            userId: p.userId,
            title: `Parent Notice: ${title}`,
            message: content.length > 120 ? `${content.substring(0, 117)}...` : content,
            category: notifCategory,
            type: 'PARENT_ANNOUNCEMENT',
            entityType: 'ANNOUNCEMENT',
            entityId: announcement.id,
          }).catch(() => {})
        )
      );
    } else if (normalizedAudience === 'CLASS' && classId) {
      // Find all parents with children in this class
      const classParents = await prisma.parentStudent.findMany({
        where: {
          student: { classId, schoolId },
          parent: { status: 'ACTIVE' },
        },
        include: { parent: { select: { userId: true } } },
      });

      const uniqueUserIds = [...new Set(classParents.map((cp) => cp.parent.userId))];
      await Promise.all(
        uniqueUserIds.map((uid) =>
          createNotification({
            schoolId,
            userId: uid,
            title: `Class Notice: ${title}`,
            message: content.length > 120 ? `${content.substring(0, 117)}...` : content,
            category: notifCategory,
            type: 'CLASS_ANNOUNCEMENT',
            entityType: 'ANNOUNCEMENT',
            entityId: announcement.id,
          }).catch(() => {})
        )
      );
    }
  } catch (e) {
    // Non-fatal notification failure
  }

  return announcement;
};

/**
 * List announcements tailored to user role and audience permissions
 */
export const listAnnouncements = async ({
  schoolId,
  userId,
  userRole,
  category = null,
  search = '',
  page = 1,
  limit = 20,
}) => {
  if (!schoolId) {
    const err = new Error('School ID is required.');
    err.statusCode = 400;
    throw err;
  }

  const take = Math.max(1, parseInt(limit, 10));
  const skip = (Math.max(1, parseInt(page, 10)) - 1) * take;

  const where = {
    schoolId,
    isPublished: true,
  };

  // Audience RBAC
  if (userRole === 'PARENT') {
    // Get parent's linked children classes
    const parent = await prisma.parent.findFirst({
      where: { userId, schoolId },
      include: {
        students: {
          select: {
            student: { select: { classId: true } },
          },
        },
      },
    });

    const childClassIds = parent
      ? parent.students.map((ps) => ps.student.classId)
      : [];

    where.OR = [
      { targetAudience: 'ALL' },
      { targetAudience: 'PARENTS' },
      { targetAudience: 'CLASS', classId: { in: childClassIds } },
    ];
  } else if (userRole === 'TEACHER') {
    // Teachers see ALL, TEACHERS, and CLASS announcements
    where.OR = [
      { targetAudience: 'ALL' },
      { targetAudience: 'TEACHERS' },
      { targetAudience: 'CLASS' },
    ];
  }
  // ADMIN sees all

  if (category && category !== 'ALL') {
    const norm = String(category).toUpperCase();
    if (VALID_ANNOUNCEMENT_CATEGORIES.includes(norm)) {
      where.category = norm;
    }
  }

  if (search && search.trim()) {
    const term = search.trim();
    const searchFilter = {
      OR: [
        { title: { contains: term, mode: 'insensitive' } },
        { content: { contains: term, mode: 'insensitive' } },
      ],
    };
    if (where.OR) {
      where.AND = [searchFilter];
    } else {
      where.OR = searchFilter.OR;
    }
  }

  const [totalCount, items] = await Promise.all([
    prisma.schoolAnnouncement.count({ where }),
    prisma.schoolAnnouncement.findMany({
      where,
      skip,
      take,
      orderBy: { publishedAt: 'desc' },
      include: {
        author: {
          select: { id: true, name: true, role: true },
        },
        class: {
          select: { id: true, name: true, section: true },
        },
        reads: userId
          ? {
              where: { userId },
              select: { readAt: true },
            }
          : false,
      },
    }),
  ]);

  return {
    announcements: items.map((a) => ({
      id: a.id,
      title: a.title,
      content: a.content,
      category: a.category,
      priority: a.priority,
      targetAudience: a.targetAudience,
      classId: a.classId,
      className: a.class ? `${a.class.name}-${a.class.section}` : null,
      attachmentUrl: a.attachmentUrl,
      publishedAt: a.publishedAt,
      createdAt: a.createdAt,
      author: a.author,
      isRead: a.reads ? a.reads.length > 0 : false,
      readAt: a.reads && a.reads[0] ? a.reads[0].readAt : null,
    })),
    pagination: {
      page: Math.max(1, parseInt(page, 10)),
      limit: take,
      totalCount,
      totalPages: Math.ceil(totalCount / take) || 1,
    },
  };
};

/**
 * Get single announcement details and mark as read
 */
export const getAnnouncementById = async ({ schoolId, announcementId, userId }) => {
  const announcement = await prisma.schoolAnnouncement.findFirst({
    where: { id: announcementId, schoolId },
    include: {
      author: { select: { id: true, name: true, role: true } },
      class: { select: { id: true, name: true, section: true } },
      reads: userId
        ? {
            where: { userId },
            select: { readAt: true },
          }
        : false,
    },
  });

  if (!announcement) {
    const err = new Error('Announcement not found.');
    err.statusCode = 404;
    throw err;
  }

  // Auto-mark as read for viewing user
  if (userId) {
    await prisma.announcementRead.upsert({
      where: {
        announcementId_userId: {
          announcementId,
          userId,
        },
      },
      update: { readAt: new Date() },
      create: {
        announcementId,
        userId,
        readAt: new Date(),
      },
    }).catch(() => {});
  }

  return {
    id: announcement.id,
    title: announcement.title,
    content: announcement.content,
    category: announcement.category,
    priority: announcement.priority,
    targetAudience: announcement.targetAudience,
    classId: announcement.classId,
    className: announcement.class ? `${announcement.class.name}-${announcement.class.section}` : null,
    attachmentUrl: announcement.attachmentUrl,
    publishedAt: announcement.publishedAt,
    createdAt: announcement.createdAt,
    author: announcement.author,
    isRead: true,
  };
};

/**
 * Update an existing announcement
 */
export const updateAnnouncement = async ({
  schoolId,
  announcementId,
  userId,
  userRole,
  data,
}) => {
  const announcement = await prisma.schoolAnnouncement.findFirst({
    where: { id: announcementId, schoolId },
  });

  if (!announcement) {
    const err = new Error('Announcement not found.');
    err.statusCode = 404;
    throw err;
  }

  // RBAC: Only admin or original author can update
  if (userRole !== 'ADMIN' && announcement.authorId !== userId) {
    const err = new Error('Access denied: You are not authorized to update this announcement.');
    err.statusCode = 403;
    throw err;
  }

  const updateFields = {};
  if (data.title) updateFields.title = data.title.trim();
  if (data.content) updateFields.content = data.content.trim();
  if (data.category && VALID_ANNOUNCEMENT_CATEGORIES.includes(String(data.category).toUpperCase())) {
    updateFields.category = String(data.category).toUpperCase();
  }
  if (data.priority) updateFields.priority = String(data.priority).toUpperCase();
  if (data.attachmentUrl !== undefined) updateFields.attachmentUrl = data.attachmentUrl;
  if (data.isPublished !== undefined) updateFields.isPublished = Boolean(data.isPublished);

  const updated = await prisma.schoolAnnouncement.update({
    where: { id: announcementId },
    data: updateFields,
    include: {
      author: { select: { id: true, name: true, role: true } },
      class: { select: { id: true, name: true, section: true } },
    },
  });

  return updated;
};

/**
 * Delete an announcement
 */
export const deleteAnnouncement = async ({
  schoolId,
  announcementId,
  userId,
  userRole,
}) => {
  const announcement = await prisma.schoolAnnouncement.findFirst({
    where: { id: announcementId, schoolId },
  });

  if (!announcement) {
    const err = new Error('Announcement not found.');
    err.statusCode = 404;
    throw err;
  }

  if (userRole !== 'ADMIN' && announcement.authorId !== userId) {
    const err = new Error('Access denied: You are not authorized to delete this announcement.');
    err.statusCode = 403;
    throw err;
  }

  await prisma.schoolAnnouncement.delete({
    where: { id: announcementId },
  });

  return { success: true, message: 'Announcement deleted successfully.' };
};

/**
 * Mark announcement as read
 */
export const markAnnouncementRead = async ({ announcementId, userId }) => {
  const read = await prisma.announcementRead.upsert({
    where: {
      announcementId_userId: {
        announcementId,
        userId,
      },
    },
    update: { readAt: new Date() },
    create: {
      announcementId,
      userId,
      readAt: new Date(),
    },
  });

  return { success: true, read };
};

/**
 * Send direct message or start thread
 */
export const sendMessage = async ({
  schoolId,
  senderId,
  receiverId,
  subject,
  content,
  category = 'GENERAL',
  studentId = null,
  attachmentUrl = null,
  threadId = null,
}) => {
  if (!schoolId || !senderId || !receiverId) {
    const err = new Error('Sender ID and Receiver ID are required.');
    err.statusCode = 400;
    throw err;
  }

  if (!subject || !content) {
    const err = new Error('Message subject and content are required.');
    err.statusCode = 400;
    throw err;
  }

  const [sender, receiver] = await Promise.all([
    prisma.user.findFirst({ where: { id: senderId, schoolId } }),
    prisma.user.findFirst({ where: { id: receiverId, schoolId } }),
  ]);

  if (!sender) {
    const err = new Error('Sender user not found.');
    err.statusCode = 404;
    throw err;
  }
  if (!receiver) {
    const err = new Error('Recipient user not found.');
    err.statusCode = 404;
    throw err;
  }

  const normalizedCategory = String(category).toUpperCase();
  const cat = VALID_MESSAGE_CATEGORIES.includes(normalizedCategory) ? normalizedCategory : 'GENERAL';

  // If studentId provided, check existence
  if (studentId) {
    const st = await prisma.student.findFirst({ where: { id: studentId, schoolId } });
    if (!st) {
      const err = new Error('Referenced student not found.');
      err.statusCode = 404;
      throw err;
    }
  }

  const message = await prisma.communicationMessage.create({
    data: {
      schoolId,
      senderId,
      receiverId,
      studentId: studentId || null,
      subject: subject.trim(),
      content: content.trim(),
      category: cat,
      attachmentUrl: attachmentUrl || null,
      threadId: threadId || null,
    },
    include: {
      sender: { select: { id: true, name: true, email: true, role: true } },
      receiver: { select: { id: true, name: true, email: true, role: true } },
      student: { select: { id: true, name: true, admissionNumber: true } },
    },
  });

  // If new thread without threadId, update threadId to message.id
  if (!threadId) {
    await prisma.communicationMessage.update({
      where: { id: message.id },
      data: { threadId: message.id },
    });
    message.threadId = message.id;
  }

  // Create notification for receiver
  try {
    await createNotification({
      schoolId,
      userId: receiverId,
      title: `Message from ${sender.name}: ${subject}`,
      message: content.length > 100 ? `${content.substring(0, 97)}...` : content,
      category: cat === 'URGENT' ? 'URGENT' : 'INFO',
      type: 'PARENT_MESSAGE',
      entityType: 'MESSAGE',
      entityId: message.id,
    });
  } catch (e) {
    // Non-fatal
  }

  return message;
};

/**
 * List message threads (inbox or sent)
 */
export const listMessages = async ({
  schoolId,
  userId,
  box = 'inbox',
  category = null,
  isRead = null,
  search = '',
  page = 1,
  limit = 20,
}) => {
  if (!schoolId || !userId) {
    const err = new Error('School ID and User ID are required.');
    err.statusCode = 400;
    throw err;
  }

  const take = Math.max(1, parseInt(limit, 10));
  const skip = (Math.max(1, parseInt(page, 10)) - 1) * take;

  const where = { schoolId };
  if (box === 'sent') {
    where.senderId = userId;
  } else {
    where.receiverId = userId;
  }

  if (category && category !== 'ALL') {
    const norm = String(category).toUpperCase();
    if (VALID_MESSAGE_CATEGORIES.includes(norm)) {
      where.category = norm;
    }
  }

  if (isRead !== null && box === 'inbox') {
    where.isRead = isRead === 'true' || isRead === true;
  }

  if (search && search.trim()) {
    const term = search.trim();
    where.OR = [
      { subject: { contains: term, mode: 'insensitive' } },
      { content: { contains: term, mode: 'insensitive' } },
      { sender: { name: { contains: term, mode: 'insensitive' } } },
      { receiver: { name: { contains: term, mode: 'insensitive' } } },
    ];
  }

  const [totalCount, messages] = await Promise.all([
    prisma.communicationMessage.count({ where }),
    prisma.communicationMessage.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        sender: { select: { id: true, name: true, email: true, role: true } },
        receiver: { select: { id: true, name: true, email: true, role: true } },
        student: {
          select: {
            id: true,
            name: true,
            admissionNumber: true,
            class: { select: { name: true, section: true } },
          },
        },
      },
    }),
  ]);

  return {
    messages: messages.map((m) => ({
      id: m.id,
      threadId: m.threadId || m.id,
      subject: m.subject,
      content: m.content,
      category: m.category,
      isRead: m.isRead,
      readAt: m.readAt,
      attachmentUrl: m.attachmentUrl,
      createdAt: m.createdAt,
      sender: m.sender,
      receiver: m.receiver,
      student: m.student ? {
        id: m.student.id,
        name: m.student.name,
        admissionNumber: m.student.admissionNumber,
        className: m.student.class ? `${m.student.class.name}-${m.student.class.section}` : '',
      } : null,
    })),
    pagination: {
      page: Math.max(1, parseInt(page, 10)),
      limit: take,
      totalCount,
      totalPages: Math.ceil(totalCount / take) || 1,
    },
  };
};

/**
 * Get entire message conversation thread and mark messages as read
 */
export const getMessageThread = async ({ schoolId, threadId, userId }) => {
  const messages = await prisma.communicationMessage.findMany({
    where: {
      schoolId,
      threadId,
    },
    orderBy: { createdAt: 'asc' },
    include: {
      sender: { select: { id: true, name: true, email: true, role: true } },
      receiver: { select: { id: true, name: true, email: true, role: true } },
      student: { select: { id: true, name: true, admissionNumber: true } },
    },
  });

  if (messages.length === 0) {
    const err = new Error('Message thread not found.');
    err.statusCode = 404;
    throw err;
  }

  // Security authorization: user must be participant in the thread
  const isParticipant = messages.some(
    (m) => m.senderId === userId || m.receiverId === userId
  );

  if (!isParticipant) {
    const err = new Error('Forbidden: You are not an authorized participant in this message thread.');
    err.statusCode = 403;
    throw err;
  }

  // Auto-mark incoming unread messages as read
  const unreadIncomingIds = messages
    .filter((m) => m.receiverId === userId && !m.isRead)
    .map((m) => m.id);

  if (unreadIncomingIds.length > 0) {
    await prisma.communicationMessage.updateMany({
      where: { id: { in: unreadIncomingIds } },
      data: { isRead: true, readAt: new Date() },
    });
  }

  return {
    threadId,
    subject: messages[0].subject,
    student: messages[0].student,
    category: messages[0].category,
    messages: messages.map((m) => ({
      id: m.id,
      content: m.content,
      attachmentUrl: m.attachmentUrl,
      isRead: unreadIncomingIds.includes(m.id) ? true : m.isRead,
      readAt: unreadIncomingIds.includes(m.id) ? new Date() : m.readAt,
      createdAt: m.createdAt,
      sender: m.sender,
      receiver: m.receiver,
      isOutgoing: m.senderId === userId,
    })),
  };
};

/**
 * Reply to an existing message thread
 */
export const replyToMessageThread = async ({
  schoolId,
  threadId,
  senderId,
  content,
  attachmentUrl = null,
}) => {
  if (!content || !content.trim()) {
    const err = new Error('Reply content cannot be empty.');
    err.statusCode = 400;
    throw err;
  }

  // Find previous message in thread to identify other participant
  const previousMessage = await prisma.communicationMessage.findFirst({
    where: { schoolId, threadId },
    orderBy: { createdAt: 'desc' },
  });

  if (!previousMessage) {
    const err = new Error('Message thread not found.');
    err.statusCode = 404;
    throw err;
  }

  // Determine receiver: the other participant
  const receiverId = previousMessage.senderId === senderId
    ? previousMessage.receiverId
    : previousMessage.senderId;

  const reply = await prisma.communicationMessage.create({
    data: {
      schoolId,
      threadId,
      senderId,
      receiverId,
      studentId: previousMessage.studentId,
      subject: previousMessage.subject.startsWith('Re: ')
        ? previousMessage.subject
        : `Re: ${previousMessage.subject}`,
      content: content.trim(),
      category: previousMessage.category,
      attachmentUrl,
    },
    include: {
      sender: { select: { id: true, name: true, email: true, role: true } },
      receiver: { select: { id: true, name: true, email: true, role: true } },
    },
  });

  // Notify receiver
  try {
    await createNotification({
      schoolId,
      userId: receiverId,
      title: `Reply from ${reply.sender.name}`,
      message: content.length > 80 ? `${content.substring(0, 77)}...` : content,
      category: reply.category === 'URGENT' ? 'URGENT' : 'INFO',
      type: 'PARENT_MESSAGE',
      entityType: 'MESSAGE',
      entityId: reply.id,
    });
  } catch (e) {
    // Non-fatal
  }

  return reply;
};

/**
 * Mark a single message as read
 */
export const markMessageRead = async ({ schoolId, messageId, userId }) => {
  const message = await prisma.communicationMessage.findFirst({
    where: { id: messageId, schoolId, receiverId: userId },
  });

  if (!message) {
    const err = new Error('Message not found or not addressed to you.');
    err.statusCode = 404;
    throw err;
  }

  const updated = await prisma.communicationMessage.update({
    where: { id: messageId },
    data: { isRead: true, readAt: new Date() },
  });

  return { success: true, message: updated };
};

/**
 * Get unread message count for user
 */
export const getUnreadMessageCount = async ({ schoolId, userId }) => {
  const count = await prisma.communicationMessage.count({
    where: {
      schoolId,
      receiverId: userId,
      isRead: false,
    },
  });
  return { unreadCount: count };
};
