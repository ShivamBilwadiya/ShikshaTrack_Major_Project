import prisma from '../config/db.js';

const VALID_CATEGORIES = ['INFO', 'WARNING', 'URGENT', 'SUCCESS'];

/**
 * Create a new notification
 */
export const createNotification = async ({
  schoolId,
  userId = null,
  title,
  message,
  category = 'INFO',
  type = 'GENERAL_ANNOUNCEMENT',
  entityType = null,
  entityId = null,
  metadata = null,
}) => {
  if (!schoolId) {
    const err = new Error('School ID is required to create a notification.');
    err.statusCode = 400;
    throw err;
  }

  if (!title || !message) {
    const err = new Error('Notification title and message are required.');
    err.statusCode = 400;
    throw err;
  }

  const normalizedCategory = String(category).toUpperCase();
  if (!VALID_CATEGORIES.includes(normalizedCategory)) {
    const err = new Error(`Invalid notification category. Must be one of: ${VALID_CATEGORIES.join(', ')}`);
    err.statusCode = 400;
    throw err;
  }

  return await prisma.notification.create({
    data: {
      schoolId,
      userId,
      title,
      message,
      category: normalizedCategory,
      type,
      entityType,
      entityId,
      metadata: metadata || undefined,
    },
    include: {
      user: { select: { id: true, name: true, email: true, role: true } },
    },
  });
};

/**
 * Get paginated, filtered notification history for the authenticated user and school
 */
export const getNotifications = async ({
  schoolId,
  userId,
  userRole,
  category,
  status,
  type,
  startDate,
  endDate,
  search,
  page = 1,
  limit = 20,
  sortBy = 'createdAt',
  sortOrder = 'desc',
}) => {
  const where = { schoolId };

  // Role-based access control:
  // Teachers only see notifications explicitly assigned to them or school-wide broadcasts (userId: null)
  // Admins can see all school notifications, or filter by specific target user
  if (userRole === 'TEACHER') {
    where.OR = [
      { userId },
      { userId: null },
    ];
  } else if (userId && userRole === 'ADMIN') {
    // If admin explicitly requested to filter by user
    where.userId = userId;
  }

  if (category && category !== 'ALL') {
    const normalizedCategory = String(category).toUpperCase();
    if (!VALID_CATEGORIES.includes(normalizedCategory)) {
      const err = new Error(`Invalid category filter. Must be one of: ${VALID_CATEGORIES.join(', ')}`);
      err.statusCode = 400;
      throw err;
    }
    where.category = normalizedCategory;
  }

  if (status) {
    const s = String(status).toUpperCase();
    if (s === 'UNREAD') {
      where.isRead = false;
    } else if (s === 'READ') {
      where.isRead = true;
    }
  }

  if (type && type !== 'ALL') {
    where.type = type;
  }

  // Date range filtering
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) {
      const s = new Date(startDate);
      s.setHours(0, 0, 0, 0);
      where.createdAt.gte = s;
    }
    if (endDate) {
      const e = new Date(endDate);
      e.setHours(23, 59, 59, 999);
      where.createdAt.lte = e;
    }
  }

  // Search filter on title or message
  if (search && search.trim()) {
    const q = search.trim();
    where.AND = [
      {
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { message: { contains: q, mode: 'insensitive' } },
        ],
      },
    ];
  }

  const validPage = Math.max(1, parseInt(page, 10) || 1);
  const validLimit = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
  const skip = (validPage - 1) * validLimit;

  // Sorting
  const allowedSortFields = ['createdAt', 'category', 'isRead', 'title'];
  const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';
  const orderDirection = sortOrder === 'asc' ? 'asc' : 'desc';

  const [totalCount, notifications, unreadCount, urgentCount, warningCount] = await Promise.all([
    prisma.notification.count({ where }),
    prisma.notification.findMany({
      where,
      skip,
      take: validLimit,
      orderBy: { [sortField]: orderDirection },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
      },
    }),
    prisma.notification.count({
      where: { ...where, isRead: false },
    }),
    prisma.notification.count({
      where: { ...where, isRead: false, category: 'URGENT' },
    }),
    prisma.notification.count({
      where: { ...where, isRead: false, category: 'WARNING' },
    }),
  ]);

  return {
    notifications,
    pagination: {
      total: totalCount,
      page: validPage,
      limit: validLimit,
      totalPages: Math.ceil(totalCount / validLimit) || 1,
    },
    summary: {
      totalCount,
      unreadCount,
      urgentCount,
      warningCount,
    },
  };
};

/**
 * Get notification summary stats and unread counts for dashboard notification center
 */
export const getNotificationSummary = async ({ schoolId, userId, userRole }) => {
  const baseWhere = { schoolId };

  if (userRole === 'TEACHER') {
    baseWhere.OR = [
      { userId },
      { userId: null },
    ];
  }

  const [totalCount, unreadCount, urgentCount, warningCount, infoCount, successCount, recentNotifications] =
    await Promise.all([
      prisma.notification.count({ where: baseWhere }),
      prisma.notification.count({ where: { ...baseWhere, isRead: false } }),
      prisma.notification.count({ where: { ...baseWhere, isRead: false, category: 'URGENT' } }),
      prisma.notification.count({ where: { ...baseWhere, isRead: false, category: 'WARNING' } }),
      prisma.notification.count({ where: { ...baseWhere, isRead: false, category: 'INFO' } }),
      prisma.notification.count({ where: { ...baseWhere, isRead: false, category: 'SUCCESS' } }),
      prisma.notification.findMany({
        where: baseWhere,
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      }),
    ]);

  return {
    totalCount,
    unreadCount,
    urgentCount,
    warningCount,
    infoCount,
    successCount,
    recentNotifications,
  };
};

/**
 * Mark a single notification as read with strict role-based access control
 */
export const markNotificationAsRead = async ({ notificationId, schoolId, userId, userRole }) => {
  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
  });

  if (!notification || notification.schoolId !== schoolId) {
    const err = new Error('Notification not found.');
    err.statusCode = 404;
    throw err;
  }

  // RBAC: If teacher, cannot mark another teacher's notification
  if (userRole === 'TEACHER' && notification.userId && notification.userId !== userId) {
    const err = new Error('Access denied: You cannot mark another faculty member\'s notification as read.');
    err.statusCode = 403;
    throw err;
  }

  return await prisma.notification.update({
    where: { id: notificationId },
    data: {
      isRead: true,
      readAt: new Date(),
    },
  });
};

/**
 * Mark all notifications as read for current user/school
 */
export const markAllNotificationsAsRead = async ({ schoolId, userId, userRole, category }) => {
  const where = {
    schoolId,
    isRead: false,
  };

  if (userRole === 'TEACHER') {
    where.OR = [
      { userId },
      { userId: null },
    ];
  }

  if (category && category !== 'ALL') {
    const normalizedCategory = String(category).toUpperCase();
    if (VALID_CATEGORIES.includes(normalizedCategory)) {
      where.category = normalizedCategory;
    }
  }

  const result = await prisma.notification.updateMany({
    where,
    data: {
      isRead: true,
      readAt: new Date(),
    },
  });

  return {
    updatedCount: result.count,
  };
};

/**
 * Dismiss and delete a notification with permission check
 */
export const deleteNotification = async ({ notificationId, schoolId, userId, userRole }) => {
  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
  });

  if (!notification || notification.schoolId !== schoolId) {
    const err = new Error('Notification not found.');
    err.statusCode = 404;
    throw err;
  }

  // RBAC: Teachers can only dismiss their own notifications
  if (userRole === 'TEACHER' && notification.userId && notification.userId !== userId) {
    const err = new Error('Access denied: You cannot dismiss another faculty member\'s notification.');
    err.statusCode = 403;
    throw err;
  }

  await prisma.notification.delete({
    where: { id: notificationId },
  });

  return {
    success: true,
    message: 'Notification dismissed successfully.',
  };
};

/**
 * Automated alert engine: evaluates attendance data to generate proactive alerts
 */
export const generateAttendanceAlerts = async ({ schoolId, triggeredByUserId }) => {
  let lowAttendanceCount = 0;
  let incompleteSessionCount = 0;
  let absenceAlertCount = 0;

  // 1. Alert for students with low attendance (< 75% or consecutive absences)
  const students = await prisma.student.findMany({
    where: { schoolId, active: true },
    include: {
      class: {
        include: {
          teacherAssignments: {
            include: { teacher: true },
          },
        },
      },
      attendanceRecords: {
        orderBy: { markedAt: 'desc' },
        take: 30,
      },
    },
  });

  for (const student of students) {
    const records = student.attendanceRecords;
    if (records.length >= 3) {
      const presentCount = records.filter((r) => r.status === 'PRESENT' || r.status === 'LATE').length;
      const rate = Math.round((presentCount / records.length) * 1000) / 10;

      // Check consecutive absences
      let consecutiveAbsences = 0;
      for (const rec of records) {
        if (rec.status === 'ABSENT') consecutiveAbsences++;
        else break;
      }

      if (consecutiveAbsences >= 3) {
        // Check if an alert was already created today for this student
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const existingAlert = await prisma.notification.findFirst({
          where: {
            schoolId,
            type: 'STUDENT_ABSENCE',
            entityId: student.id,
            createdAt: { gte: todayStart },
          },
        });

        if (!existingAlert) {
          const classTeacherTa = student.class.teacherAssignments.find((ta) => ta.isClassTeacher) ||
            student.class.teacherAssignments[0];

          await prisma.notification.create({
            data: {
              schoolId,
              userId: classTeacherTa ? classTeacherTa.teacherId : null,
              title: `Chronic Absence Alert: ${student.name}`,
              message: `${student.name} (Roll: ${student.rollNumber || 'N/A'}, Admission: ${student.admissionNumber}) in Class ${student.class.name}-${student.class.section} has been absent for ${consecutiveAbsences} consecutive instructional days. RTE statutory intervention recommended.`,
              category: 'URGENT',
              type: 'STUDENT_ABSENCE',
              entityType: 'STUDENT',
              entityId: student.id,
              metadata: {
                studentId: student.id,
                studentName: student.name,
                admissionNumber: student.admissionNumber,
                className: `${student.class.name}-${student.class.section}`,
                consecutiveAbsences,
                attendanceRate: rate,
              },
            },
          });
          absenceAlertCount++;
        }
      } else if (rate < 75) {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const existingAlert = await prisma.notification.findFirst({
          where: {
            schoolId,
            type: 'LOW_ATTENDANCE',
            entityId: student.id,
            createdAt: { gte: todayStart },
          },
        });

        if (!existingAlert) {
          const classTeacherTa = student.class.teacherAssignments.find((ta) => ta.isClassTeacher) ||
            student.class.teacherAssignments[0];

          await prisma.notification.create({
            data: {
              schoolId,
              userId: classTeacherTa ? classTeacherTa.teacherId : null,
              title: `Low Attendance Warning: ${student.name} (${rate}%)`,
              message: `${student.name} in Class ${student.class.name}-${student.class.section} has an attendance rate of ${rate}%, falling below the statutory 75% threshold. Guardian follow-up required.`,
              category: rate < 60 ? 'URGENT' : 'WARNING',
              type: 'LOW_ATTENDANCE',
              entityType: 'STUDENT',
              entityId: student.id,
              metadata: {
                studentId: student.id,
                studentName: student.name,
                admissionNumber: student.admissionNumber,
                className: `${student.class.name}-${student.class.section}`,
                attendanceRate: rate,
              },
            },
          });
          lowAttendanceCount++;
        }
      }
    }
  }

  // 2. Alert for incomplete or unclosed attendance sessions
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const openSessions = await prisma.attendanceSession.findMany({
    where: {
      class: { schoolId },
      sessionDate: { gte: sevenDaysAgo },
      OR: [
        { status: 'OPEN' },
      ],
    },
    include: {
      class: {
        include: {
          students: { where: { active: true }, select: { id: true } },
        },
      },
      teacher: true,
      attendanceRecords: { select: { id: true } },
    },
  });

  for (const session of openSessions) {
    const enrolledCount = session.class.students.length;
    const markedCount = session.attendanceRecords.length;
    const isUnclosed = session.status === 'OPEN';
    const hasUnmarked = markedCount < enrolledCount;

    if (isUnclosed || hasUnmarked) {
      const existingSessionAlert = await prisma.notification.findFirst({
        where: {
          schoolId,
          type: 'INCOMPLETE_SESSION',
          entityId: session.id,
        },
      });

      if (!existingSessionAlert) {
        const sessionDateStr = session.sessionDate.toISOString().split('T')[0];
        const missingCount = Math.max(0, enrolledCount - markedCount);

        await prisma.notification.create({
          data: {
            schoolId,
            userId: session.teacherId,
            title: `Incomplete Attendance Roll Call: ${session.class.name}-${session.class.section}`,
            message: `Attendance session conducted on ${sessionDateStr} by ${session.teacher.name} is ${isUnclosed ? 'still OPEN' : 'incomplete'}. ${missingCount} student(s) unmarked. Please finalize and close session.`,
            category: 'WARNING',
            type: 'INCOMPLETE_SESSION',
            entityType: 'SESSION',
            entityId: session.id,
            metadata: {
              sessionId: session.id,
              teacherId: session.teacherId,
              teacherName: session.teacher.name,
              classId: session.classId,
              className: `${session.class.name}-${session.class.section}`,
              sessionDate: sessionDateStr,
              enrolledCount,
              markedCount,
              missingCount,
              status: session.status,
            },
          },
        });
        incompleteSessionCount++;
      }
    }
  }

  return {
    generatedCount: lowAttendanceCount + incompleteSessionCount + absenceAlertCount,
    details: {
      lowAttendanceCount,
      incompleteSessionCount,
      absenceAlertCount,
    },
  };
};
