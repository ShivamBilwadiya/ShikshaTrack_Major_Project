import prisma from '../config/db.js';

/**
 * Valid Leave Types & Statuses
 */
export const LEAVE_TYPES = ['SICK', 'FAMILY', 'PERSONAL', 'EMERGENCY', 'OTHER'];
export const LEAVE_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'];

/**
 * Helper to write audit logs
 */
const logAudit = async ({ actorId, action, entityType, entityId, previousValue, newValue, reason }) => {
  try {
    await prisma.auditLog.create({
      data: {
        actorId,
        action,
        entityType,
        entityId,
        previousValue: previousValue ? JSON.stringify(previousValue) : null,
        newValue: newValue ? JSON.stringify(newValue) : null,
        reason,
      },
    });
  } catch (err) {
    console.error('Failed to write audit log:', err.message);
  }
};

/**
 * Validate and calculate date difference for leave
 */
export const normalizeAndValidateDates = (startDate, endDate) => {
  if (!startDate || !endDate) {
    throw new Error('Both start date and end date are required.');
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw new Error('Invalid date format provided.');
  }

  // Normalize to midnight UTC for date comparison
  start.setUTCHours(0, 0, 0, 0);
  end.setUTCHours(23, 59, 59, 999);

  if (start > end) {
    throw new Error('Start date cannot be after end date.');
  }

  // Calculate inclusive calendar days
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return {
    start,
    end,
    totalDays: diffDays > 0 ? diffDays : 1,
  };
};

/**
 * Check if student has overlapping active leave
 */
export const checkOverlappingLeave = async ({ studentId, start, end, excludeLeaveId }) => {
  const whereClause = {
    studentId,
    status: { in: ['PENDING', 'APPROVED'] },
    startDate: { lte: end },
    endDate: { gte: start },
  };

  if (excludeLeaveId) {
    whereClause.id = { not: excludeLeaveId };
  }

  const existing = await prisma.studentLeave.findFirst({
    where: whereClause,
    include: {
      student: { select: { name: true, admissionNumber: true } },
    },
  });

  if (existing) {
    const sStr = existing.startDate.toISOString().split('T')[0];
    const eStr = existing.endDate.toISOString().split('T')[0];
    throw new Error(
      `Student already has an active ${existing.status.toLowerCase()} leave application for ${existing.student.name} from ${sStr} to ${eStr}. Overlapping leave is not allowed.`
    );
  }
};

/**
 * Apply for student leave
 */
export const applyLeave = async ({
  schoolId,
  studentId,
  classId,
  leaveType = 'SICK',
  startDate,
  endDate,
  reason,
  documentUrl = null,
  appliedById = null,
}) => {
  if (!studentId) {
    throw new Error('Student ID is required.');
  }
  if (!reason || !reason.trim()) {
    throw new Error('Leave reason is required and must not be empty.');
  }
  if (!LEAVE_TYPES.includes(leaveType)) {
    throw new Error(`Invalid leave type "${leaveType}". Allowed types: ${LEAVE_TYPES.join(', ')}`);
  }

  // Find student and confirm school ownership
  const student = await prisma.student.findFirst({
    where: { id: studentId, schoolId },
    include: { class: true },
  });

  if (!student) {
    throw new Error('Student not found in this school.');
  }

  const resolvedClassId = classId || student.classId;
  const { start, end, totalDays } = normalizeAndValidateDates(startDate, endDate);

  // Overlap verification
  await checkOverlappingLeave({ studentId, start, end });

  const leave = await prisma.studentLeave.create({
    data: {
      schoolId,
      studentId,
      classId: resolvedClassId,
      appliedById,
      leaveType,
      startDate: start,
      endDate: end,
      totalDays,
      reason: reason.trim(),
      documentUrl: documentUrl ? documentUrl.trim() : null,
      status: 'PENDING',
    },
    include: {
      student: { select: { id: true, name: true, admissionNumber: true, rollNumber: true } },
      class: { select: { id: true, name: true, section: true } },
      appliedBy: { select: { id: true, name: true, role: true, email: true } },
    },
  });

  await logAudit({
    actorId: appliedById,
    action: 'LEAVE_APPLIED',
    entityType: 'StudentLeave',
    entityId: leave.id,
    newValue: {
      studentId,
      leaveType,
      startDate: start,
      endDate: end,
      totalDays,
      status: 'PENDING',
    },
    reason: `Leave application submitted for ${student.name}`,
  });

  return leave;
};

/**
 * List leave applications with advanced filters
 */
export const listLeaves = async ({
  schoolId,
  userRole,
  userId,
  classId,
  studentId,
  status,
  leaveType,
  startDate,
  endDate,
  search,
  page = 1,
  limit = 20,
}) => {
  const where = { schoolId };

  if (classId) {
    where.classId = classId;
  }

  if (studentId) {
    where.studentId = studentId;
  }

  if (status) {
    if (Array.isArray(status)) {
      where.status = { in: status };
    } else {
      where.status = status;
    }
  }

  if (leaveType) {
    where.leaveType = leaveType;
  }

  if (startDate || endDate) {
    where.AND = where.AND || [];
    if (startDate) {
      where.AND.push({ endDate: { gte: new Date(startDate) } });
    }
    if (endDate) {
      where.AND.push({ startDate: { lte: new Date(endDate) } });
    }
  }

  if (search && search.trim()) {
    const q = search.trim();
    where.OR = [
      { student: { name: { contains: q, mode: 'insensitive' } } },
      { student: { admissionNumber: { contains: q, mode: 'insensitive' } } },
      { reason: { contains: q, mode: 'insensitive' } },
    ];
  }

  // Teacher role scoping: Teachers can see leaves for their assigned classes or overall if permitted
  if (userRole === 'TEACHER' && !classId) {
    const assignments = await prisma.teacherAssignment.findMany({
      where: { teacherId: userId },
      select: { classId: true },
    });
    if (assignments.length > 0) {
      where.classId = { in: assignments.map((a) => a.classId) };
    }
  }

  const p = Math.max(1, parseInt(page, 10) || 1);
  const l = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (p - 1) * l;

  const [total, leaves] = await Promise.all([
    prisma.studentLeave.count({ where }),
    prisma.studentLeave.findMany({
      where,
      skip,
      take: l,
      orderBy: [{ createdAt: 'desc' }],
      include: {
        student: {
          select: {
            id: true,
            name: true,
            admissionNumber: true,
            rollNumber: true,
            gender: true,
          },
        },
        class: {
          select: {
            id: true,
            name: true,
            section: true,
            academicYear: true,
          },
        },
        appliedBy: {
          select: {
            id: true,
            name: true,
            role: true,
            email: true,
          },
        },
        reviewedBy: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
        decisions: {
          orderBy: { decidedAt: 'desc' },
          include: {
            reviewer: {
              select: { id: true, name: true, role: true },
            },
          },
        },
      },
    }),
  ]);

  return {
    leaves,
    pagination: {
      total,
      page: p,
      limit: l,
      totalPages: Math.ceil(total / l) || 1,
    },
  };
};

/**
 * Get single leave details
 */
export const getLeaveById = async (leaveId, schoolId) => {
  const leave = await prisma.studentLeave.findFirst({
    where: { id: leaveId, schoolId },
    include: {
      student: {
        select: {
          id: true,
          name: true,
          admissionNumber: true,
          rollNumber: true,
          guardianName: true,
          guardianPhone: true,
        },
      },
      class: {
        select: {
          id: true,
          name: true,
          section: true,
          academicYear: true,
        },
      },
      appliedBy: {
        select: { id: true, name: true, email: true, role: true },
      },
      reviewedBy: {
        select: { id: true, name: true, role: true },
      },
      decisions: {
        orderBy: { decidedAt: 'desc' },
        include: {
          reviewer: { select: { id: true, name: true, role: true } },
        },
      },
    },
  });

  if (!leave) {
    throw new Error('Leave application not found.');
  }

  return leave;
};

/**
 * Review leave (Approve / Reject) with mandatory remarks
 */
export const reviewLeave = async ({
  leaveId,
  schoolId,
  reviewerId,
  action,
  remarks,
  userRole = 'ADMIN',
}) => {
  if (!['APPROVED', 'REJECTED'].includes(action)) {
    throw new Error('Decision action must be either "APPROVED" or "REJECTED".');
  }

  if (!remarks || !remarks.trim()) {
    throw new Error('Review remarks are mandatory for approving or rejecting leave.');
  }

  const leave = await prisma.studentLeave.findFirst({
    where: { id: leaveId, schoolId },
    include: {
      student: { select: { id: true, name: true } },
      class: true,
    },
  });

  if (!leave) {
    throw new Error('Leave application not found.');
  }

  if (leave.status !== 'PENDING') {
    throw new Error(`Cannot review leave that is already ${leave.status}. Only PENDING leaves can be reviewed.`);
  }

  // Teacher permission check: If teacher, ensure teacher has access to this class
  if (userRole === 'TEACHER') {
    const assignment = await prisma.teacherAssignment.findFirst({
      where: { teacherId: reviewerId, classId: leave.classId },
    });
    if (!assignment) {
      throw new Error('Unauthorized: Teachers can only review leave applications for their assigned classes.');
    }
  }

  const decisionTimestamp = new Date();

  // Transaction for atomic update and decision record
  const [updatedLeave, decision] = await prisma.$transaction([
    prisma.studentLeave.update({
      where: { id: leaveId },
      data: {
        status: action,
        reviewRemarks: remarks.trim(),
        reviewedAt: decisionTimestamp,
        reviewedById: reviewerId,
      },
      include: {
        student: { select: { id: true, name: true, admissionNumber: true } },
        class: { select: { id: true, name: true, section: true } },
        reviewedBy: { select: { id: true, name: true, role: true } },
        decisions: true,
      },
    }),
    prisma.studentLeaveDecision.create({
      data: {
        leaveId,
        reviewerId,
        action,
        remarks: remarks.trim(),
        decidedAt: decisionTimestamp,
      },
    }),
  ]);

  await logAudit({
    actorId: reviewerId,
    action: `LEAVE_${action}`,
    entityType: 'StudentLeave',
    entityId: leaveId,
    previousValue: { status: 'PENDING' },
    newValue: { status: action, remarks: remarks.trim() },
    reason: `Leave ${action.toLowerCase()} by reviewer: ${remarks.trim()}`,
  });

  return { ...updatedLeave, latestDecision: decision };
};

/**
 * Bulk review leaves
 */
export const bulkReviewLeaves = async ({
  leaveIds,
  schoolId,
  reviewerId,
  action,
  remarks,
  userRole = 'ADMIN',
}) => {
  if (!Array.isArray(leaveIds) || leaveIds.length === 0) {
    throw new Error('leaveIds must be a non-empty array of leave application IDs.');
  }

  const results = {
    successful: [],
    failed: [],
  };

  for (const id of leaveIds) {
    try {
      const reviewed = await reviewLeave({
        leaveId: id,
        schoolId,
        reviewerId,
        action,
        remarks,
        userRole,
      });
      results.successful.push({
        id,
        studentName: reviewed.student.name,
        status: reviewed.status,
      });
    } catch (err) {
      results.failed.push({
        id,
        error: err.message,
      });
    }
  }

  return results;
};

/**
 * Cancel leave application
 */
export const cancelLeave = async ({ leaveId, schoolId, userId, userRole, reason }) => {
  const leave = await prisma.studentLeave.findFirst({
    where: { id: leaveId, schoolId },
    include: { student: true },
  });

  if (!leave) {
    throw new Error('Leave application not found.');
  }

  if (leave.status === 'CANCELLED') {
    throw new Error('Leave application is already cancelled.');
  }

  // Only applicant or admin/assigned teacher can cancel
  if (userRole !== 'ADMIN' && leave.appliedById !== userId) {
    throw new Error('Unauthorized to cancel this leave application.');
  }

  const cancelRemarks = reason || 'Cancelled by user request.';

  const [updated] = await prisma.$transaction([
    prisma.studentLeave.update({
      where: { id: leaveId },
      data: {
        status: 'CANCELLED',
        reviewRemarks: cancelRemarks,
      },
      include: {
        student: true,
        class: true,
      },
    }),
    prisma.studentLeaveDecision.create({
      data: {
        leaveId,
        reviewerId: userId,
        action: 'CANCELLED',
        remarks: cancelRemarks,
      },
    }),
  ]);

  await logAudit({
    actorId: userId,
    action: 'LEAVE_CANCELLED',
    entityType: 'StudentLeave',
    entityId: leaveId,
    previousValue: { status: leave.status },
    newValue: { status: 'CANCELLED' },
    reason: cancelRemarks,
  });

  return updated;
};

/**
 * Get leave statistics and summaries
 */
export const getLeaveSummary = async ({ schoolId, classId, startDate, endDate }) => {
  const where = { schoolId };
  if (classId) {
    where.classId = classId;
  }
  if (startDate || endDate) {
    where.AND = [];
    if (startDate) where.AND.push({ endDate: { gte: new Date(startDate) } });
    if (endDate) where.AND.push({ startDate: { lte: new Date(endDate) } });
  }

  const leaves = await prisma.studentLeave.findMany({
    where,
    select: {
      id: true,
      leaveType: true,
      status: true,
      totalDays: true,
      startDate: true,
      endDate: true,
      classId: true,
    },
  });

  const summary = {
    totalApplications: leaves.length,
    pendingCount: 0,
    approvedCount: 0,
    rejectedCount: 0,
    cancelledCount: 0,
    totalApprovedDays: 0,
    byType: {
      SICK: 0,
      FAMILY: 0,
      PERSONAL: 0,
      EMERGENCY: 0,
      OTHER: 0,
    },
  };

  leaves.forEach((l) => {
    if (l.status === 'PENDING') summary.pendingCount++;
    else if (l.status === 'APPROVED') {
      summary.approvedCount++;
      summary.totalApprovedDays += l.totalDays;
    } else if (l.status === 'REJECTED') summary.rejectedCount++;
    else if (l.status === 'CANCELLED') summary.cancelledCount++;

    if (summary.byType[l.leaveType] !== undefined) {
      summary.byType[l.leaveType]++;
    }
  });

  summary.approvalRate =
    summary.totalApplications > 0
      ? Math.round((summary.approvedCount / summary.totalApplications) * 100)
      : 0;

  return summary;
};

/**
 * Attendance Integration: Get all approved leaves for a class on a given date
 */
export const getApprovedLeavesForAttendance = async ({ schoolId, classId, date }) => {
  const targetDate = date ? new Date(date) : new Date();
  const startOfDay = new Date(targetDate);
  startOfDay.setUTCHours(0, 0, 0, 0);
  const endOfDay = new Date(targetDate);
  endOfDay.setUTCHours(23, 59, 59, 999);

  const approvedLeaves = await prisma.studentLeave.findMany({
    where: {
      schoolId,
      classId,
      status: 'APPROVED',
      startDate: { lte: endOfDay },
      endDate: { gte: startOfDay },
    },
    include: {
      student: {
        select: {
          id: true,
          name: true,
          admissionNumber: true,
          rollNumber: true,
        },
      },
    },
  });

  return approvedLeaves.map((l) => ({
    leaveId: l.id,
    studentId: l.studentId,
    studentName: l.student.name,
    admissionNumber: l.student.admissionNumber,
    rollNumber: l.student.rollNumber,
    leaveType: l.leaveType,
    startDate: l.startDate,
    endDate: l.endDate,
    totalDays: l.totalDays,
    reason: l.reason,
    approvedRemarks: l.reviewRemarks,
  }));
};

/**
 * Student-wise leave history and usage
 */
export const getStudentLeaveHistory = async (studentId, schoolId) => {
  const student = await prisma.student.findFirst({
    where: { id: studentId, schoolId },
    include: { class: true },
  });

  if (!student) {
    throw new Error('Student not found in this school.');
  }

  const leaves = await prisma.studentLeave.findMany({
    where: { studentId, schoolId },
    orderBy: { startDate: 'desc' },
    include: {
      reviewedBy: { select: { id: true, name: true, role: true } },
      decisions: {
        orderBy: { decidedAt: 'desc' },
        include: { reviewer: { select: { id: true, name: true } } },
      },
    },
  });

  const totalApprovedDays = leaves
    .filter((l) => l.status === 'APPROVED')
    .reduce((sum, l) => sum + l.totalDays, 0);

  return {
    student: {
      id: student.id,
      name: student.name,
      admissionNumber: student.admissionNumber,
      rollNumber: student.rollNumber,
      class: `${student.class.name}-${student.class.section}`,
    },
    totalApprovedDays,
    totalApplications: leaves.length,
    leaves,
  };
};

/**
 * Helper to escape CSV values according to RFC 4180
 */
const escapeCsvField = (field) => {
  if (field === null || field === undefined) return '';
  const stringValue = String(field);
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n') || stringValue.includes('\r')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
};

/**
 * Export leave applications to RFC-4180 CSV
 */
export const generateLeaveCsv = async ({ schoolId, classId, status, leaveType }) => {
  const where = { schoolId };
  if (classId) where.classId = classId;
  if (status) where.status = status;
  if (leaveType) where.leaveType = leaveType;

  const leaves = await prisma.studentLeave.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      student: { select: { name: true, admissionNumber: true, rollNumber: true } },
      class: { select: { name: true, section: true } },
      reviewedBy: { select: { name: true } },
      appliedBy: { select: { name: true } },
    },
  });

  const headers = [
    'Leave ID',
    'Student Name',
    'Admission Number',
    'Roll Number',
    'Class',
    'Leave Type',
    'Start Date',
    'End Date',
    'Total Days',
    'Status',
    'Reason',
    'Review Remarks',
    'Reviewed By',
    'Applied At',
  ];

  const rows = leaves.map((l) => [
    escapeCsvField(l.id),
    escapeCsvField(l.student.name),
    escapeCsvField(l.student.admissionNumber),
    escapeCsvField(l.student.rollNumber || 'N/A'),
    escapeCsvField(`${l.class.name}-${l.class.section}`),
    escapeCsvField(l.leaveType),
    escapeCsvField(l.startDate.toISOString().split('T')[0]),
    escapeCsvField(l.endDate.toISOString().split('T')[0]),
    escapeCsvField(l.totalDays),
    escapeCsvField(l.status),
    escapeCsvField(l.reason),
    escapeCsvField(l.reviewRemarks || 'N/A'),
    escapeCsvField(l.reviewedBy ? l.reviewedBy.name : 'N/A'),
    escapeCsvField(l.createdAt.toISOString().split('T')[0]),
  ]);

  return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
};
