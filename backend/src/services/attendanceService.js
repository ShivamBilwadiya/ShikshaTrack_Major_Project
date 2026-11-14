import prisma from '../config/db.js';
import { logAudit } from './auditService.js';

/**
 * Start or get active attendance session for class & date
 */
export const startSession = async ({ classId, teacherId, schoolId, sessionDate, notes }) => {
  // Verify class exists and belongs to school
  const cls = await prisma.class.findFirst({
    where: { id: classId, schoolId },
  });

  if (!cls) {
    throw new Error('Class not found in this school.');
  }

  const targetDate = sessionDate ? new Date(sessionDate) : new Date();
  const startOfDay = new Date(targetDate);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);

  // Check for existing open session today
  let session = await prisma.attendanceSession.findFirst({
    where: {
      classId,
      sessionDate: {
        gte: startOfDay,
        lte: endOfDay,
      },
      status: 'OPEN',
    },
    include: {
      class: true,
      teacher: { select: { id: true, name: true, email: true } },
      attendanceRecords: {
        include: {
          student: true,
        },
      },
    },
  });

  if (!session) {
    session = await prisma.attendanceSession.create({
      data: {
        classId,
        teacherId,
        sessionDate: targetDate,
        status: 'OPEN',
        notes: notes || `Attendance session for ${cls.name}-${cls.section}`,
      },
      include: {
        class: true,
        teacher: { select: { id: true, name: true, email: true } },
        attendanceRecords: {
          include: {
            student: true,
          },
        },
      },
    });

    await logAudit({
      actorId: teacherId,
      action: 'SESSION_STARTED',
      entityType: 'AttendanceSession',
      entityId: session.id,
      newValue: { classId, sessionDate: targetDate },
    });
  }

  return session;
};

/**
 * Get details of a session including roster and marked status
 */
export const getSessionDetails = async (sessionId, schoolId) => {
  const session = await prisma.attendanceSession.findFirst({
    where: {
      id: sessionId,
      class: { schoolId },
    },
    include: {
      class: true,
      teacher: { select: { id: true, name: true, email: true } },
      attendanceRecords: {
        include: {
          student: true,
        },
      },
    },
  });

  if (!session) {
    throw new Error('Attendance session not found.');
  }

  // Fetch all enrolled active students in this class
  const students = await prisma.student.findMany({
    where: {
      classId: session.classId,
      schoolId,
      active: true,
    },
    orderBy: [{ rollNumber: 'asc' }, { name: 'asc' }],
  });

  const recordMap = new Map();
  for (const record of session.attendanceRecords) {
    recordMap.set(record.studentId, record);
  }

  const roster = students.map((st) => {
    const record = recordMap.get(st.id);
    return {
      studentId: st.id,
      name: st.name,
      admissionNumber: st.admissionNumber,
      rollNumber: st.rollNumber,
      qrToken: st.qrToken,
      marked: Boolean(record),
      status: record ? record.status : 'UNMARKED',
      method: record ? record.method : null,
      markedAt: record ? record.markedAt : null,
      recordId: record ? record.id : null,
      remarks: record ? record.remarks : null,
    };
  });

  const presentCount = roster.filter((r) => r.status === 'PRESENT').length;
  const lateCount = roster.filter((r) => r.status === 'LATE').length;
  const absentCount = roster.filter((r) => r.status === 'ABSENT').length;
  const unmarkedCount = roster.filter((r) => r.status === 'UNMARKED').length;

  return {
    session: {
      id: session.id,
      classId: session.classId,
      className: `${session.class.name}-${session.class.section}`,
      teacherName: session.teacher.name,
      teacherId: session.teacherId,
      sessionDate: session.sessionDate,
      status: session.status,
      notes: session.notes,
      createdAt: session.createdAt,
      closedAt: session.closedAt,
    },
    stats: {
      totalStudents: students.length,
      presentCount,
      lateCount,
      absentCount,
      unmarkedCount,
      attendanceRate: students.length > 0 ? Math.round(((presentCount + lateCount) / students.length) * 100) : 0,
    },
    roster,
  };
};

/**
 * Scan QR code and mark attendance
 */
export const scanQrCode = async ({ sessionId, qrToken, schoolId, teacherId, status = 'PRESENT' }) => {
  // 1. Fetch Session
  const session = await prisma.attendanceSession.findFirst({
    where: {
      id: sessionId,
      class: { schoolId },
    },
    include: {
      class: true,
    },
  });

  if (!session) {
    throw new Error('Attendance session not found.');
  }

  if (session.status === 'CLOSED') {
    throw new Error('Cannot scan: Attendance session has already been closed.');
  }

  // 2. Validate QR Token
  const student = await prisma.student.findFirst({
    where: {
      qrToken: qrToken.trim(),
      schoolId,
      active: true,
    },
    include: {
      class: true,
    },
  });

  if (!student) {
    throw new Error('Invalid QR Code: Student not found or code not recognized.');
  }

  // 3. Verify Class Membership
  if (student.classId !== session.classId) {
    throw new Error(
      `Wrong Class! Student ${student.name} belongs to ${student.class.name}-${student.class.section}, not ${session.class.name}-${session.class.section}.`
    );
  }

  // 4. Duplicate scan check & transactional recording
  try {
    const result = await prisma.$transaction(async (tx) => {
      const existingRecord = await tx.attendanceRecord.findUnique({
        where: {
          sessionId_studentId: {
            sessionId,
            studentId: student.id,
          },
        },
      });

      if (existingRecord) {
        throw new Error(
          `Duplicate Scan! Attendance for ${student.name} was already marked as ${existingRecord.status} at ${new Date(
            existingRecord.markedAt
          ).toLocaleTimeString()}.`
        );
      }

      const record = await tx.attendanceRecord.create({
        data: {
          sessionId,
          studentId: student.id,
          status: status || 'PRESENT',
          method: 'QR',
          markedAt: new Date(),
        },
        include: {
          student: true,
        },
      });

      return record;
    });

    await logAudit({
      actorId: teacherId,
      action: 'ATTENDANCE_SCANNED',
      entityType: 'AttendanceRecord',
      entityId: result.id,
      newValue: { studentId: student.id, status: result.status, method: 'QR' },
    });

    return {
      record: result,
      student: {
        id: student.id,
        name: student.name,
        admissionNumber: student.admissionNumber,
        rollNumber: student.rollNumber,
        className: `${session.class.name}-${session.class.section}`,
      },
      markedAt: result.markedAt,
    };
  } catch (err) {
    if (err.code === 'P2002') {
      throw new Error(`Duplicate Scan! Attendance for ${student.name} has already been recorded for this session.`);
    }
    throw err;
  }
};

export const VALID_ATTENDANCE_STATUSES = ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'];

/**
 * Mark manual attendance for a single student or batch
 */
export const markManualRecord = async ({
  sessionId,
  studentId,
  status,
  remarks,
  schoolId,
  actorId,
  method = 'MANUAL',
  preventDuplicate = false,
}) => {
  const normStatus = status ? status.toUpperCase() : null;
  if (!normStatus || !VALID_ATTENDANCE_STATUSES.includes(normStatus)) {
    const err = new Error(
      `Invalid attendance status: "${status}". Supported values are: ${VALID_ATTENDANCE_STATUSES.join(', ')}.`
    );
    err.statusCode = 400;
    throw err;
  }

  const VALID_METHODS = ['MANUAL', 'QR', 'OFFLINE_SYNC'];
  const recordMethod = VALID_METHODS.includes(method) ? method : 'MANUAL';

  const session = await prisma.attendanceSession.findFirst({
    where: { id: sessionId, class: { schoolId } },
  });

  if (!session) {
    const err = new Error('Attendance session not found.');
    err.statusCode = 404;
    throw err;
  }

  if (session.status === 'CLOSED') {
    const err = new Error('Cannot modify: Session is already closed.');
    err.statusCode = 400;
    throw err;
  }

  // Verify student belongs to session class
  const student = await prisma.student.findFirst({
    where: { id: studentId, classId: session.classId, schoolId, active: true },
  });

  if (!student) {
    const err = new Error('Student does not belong to this class.');
    err.statusCode = 400;
    throw err;
  }

  try {
    const record = await prisma.$transaction(async (tx) => {
      const existing = await tx.attendanceRecord.findUnique({
        where: {
          sessionId_studentId: {
            sessionId,
            studentId,
          },
        },
      });

      if (preventDuplicate && existing) {
        const err = new Error(
          `Duplicate Entry! Attendance for ${student.name} has already been marked as ${existing.status} in this session.`
        );
        err.statusCode = 400;
        throw err;
      }

      const rec = await tx.attendanceRecord.upsert({
        where: {
          sessionId_studentId: {
            sessionId,
            studentId,
          },
        },
        update: {
          status: normStatus,
          method: recordMethod,
          remarks: remarks !== undefined ? remarks : existing?.remarks,
          markedAt: new Date(),
        },
        create: {
          sessionId,
          studentId,
          status: normStatus,
          method: recordMethod,
          remarks: remarks || null,
          markedAt: new Date(),
        },
        include: {
          student: true,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: actorId || null,
          action: existing ? 'ATTENDANCE_RECORD_UPDATED' : 'ATTENDANCE_MARKED_MANUAL',
          entityType: 'AttendanceRecord',
          entityId: rec.id,
          previousValue: existing ? JSON.stringify({ status: existing.status, method: existing.method }) : null,
          newValue: JSON.stringify({ studentId, status: normStatus, method: recordMethod, remarks: remarks || null }),
          reason: existing ? 'Manual status change' : 'Initial manual mark',
        },
      });

      return rec;
    });

    return record;
  } catch (err) {
    if (err.code === 'P2002') {
      const p2002Err = new Error(
        `Duplicate Entry! Attendance for ${student.name} has already been recorded for this session.`
      );
      p2002Err.statusCode = 400;
      throw p2002Err;
    }
    throw err;
  }
};

/**
 * Bulk mark manual attendance for multiple students
 */
export const bulkMarkManual = async ({ sessionId, records, schoolId, actorId, preventDuplicate = false }) => {
  const session = await prisma.attendanceSession.findFirst({
    where: { id: sessionId, class: { schoolId } },
  });

  if (!session) {
    const err = new Error('Attendance session not found.');
    err.statusCode = 404;
    throw err;
  }

  if (session.status === 'CLOSED') {
    const err = new Error('Cannot update: Session is already closed.');
    err.statusCode = 400;
    throw err;
  }

  // 1. Validate incoming records batch
  const seenStudentIds = new Set();
  for (const item of records) {
    if (!item.studentId) {
      const err = new Error('Student ID is required for all records in bulk update.');
      err.statusCode = 400;
      throw err;
    }
    if (seenStudentIds.has(item.studentId)) {
      const err = new Error(
        `Duplicate Entry! Multiple attendance entries provided for student ID "${item.studentId}" in the same request.`
      );
      err.statusCode = 400;
      throw err;
    }
    seenStudentIds.add(item.studentId);

    const normStatus = item.status ? item.status.toUpperCase() : null;
    if (!normStatus || !VALID_ATTENDANCE_STATUSES.includes(normStatus)) {
      const err = new Error(
        `Invalid attendance status "${item.status}" for student ID "${item.studentId}". Supported values are: ${VALID_ATTENDANCE_STATUSES.join(', ')}.`
      );
      err.statusCode = 400;
      throw err;
    }
    item.status = normStatus;
  }

  // 2. Atomic bulk transaction
  const updatedRecords = await prisma.$transaction(async (tx) => {
    if (preventDuplicate) {
      const existing = await tx.attendanceRecord.findFirst({
        where: {
          sessionId,
          studentId: { in: Array.from(seenStudentIds) },
        },
      });
      if (existing) {
        const err = new Error(
          `Duplicate Entry! Student ID "${existing.studentId}" already has attendance recorded for this session.`
        );
        err.statusCode = 400;
        throw err;
      }
    }

    const batch = [];
    for (const item of records) {
      const record = await tx.attendanceRecord.upsert({
        where: {
          sessionId_studentId: {
            sessionId,
            studentId: item.studentId,
          },
        },
        update: {
          status: item.status,
          method: 'MANUAL',
          remarks: item.remarks || null,
          markedAt: new Date(),
        },
        create: {
          sessionId,
          studentId: item.studentId,
          status: item.status,
          method: 'MANUAL',
          remarks: item.remarks || null,
          markedAt: new Date(),
        },
      });
      batch.push(record);
    }

    await tx.auditLog.create({
      data: {
        actorId: actorId || null,
        action: 'ATTENDANCE_BULK_MARKED',
        entityType: 'AttendanceSession',
        entityId: sessionId,
        newValue: JSON.stringify({ count: batch.length, records: batch.map((b) => ({ id: b.id, studentId: b.studentId, status: b.status })) }),
      },
    });

    return batch;
  });

  return updatedRecords;
};

/**
 * Review and Close Attendance Session
 * Allows finalizing unmarked students with chosen status or leaving them as reviewable.
 */
export const closeSession = async ({ sessionId, schoolId, actorId, finalizeUnmarkedStatus = null }) => {
  const session = await prisma.attendanceSession.findFirst({
    where: { id: sessionId, class: { schoolId } },
    include: {
      class: true,
    },
  });

  if (!session) {
    throw new Error('Attendance session not found.');
  }

  if (session.status === 'CLOSED') {
    return { session, message: 'Session was already closed.' };
  }

  // If teacher explicitly requested finalizing unmarked students (e.g. ABSENT)
  if (finalizeUnmarkedStatus) {
    const allStudents = await prisma.student.findMany({
      where: { classId: session.classId, schoolId, active: true },
    });

    const existingRecords = await prisma.attendanceRecord.findMany({
      where: { sessionId },
      select: { studentId: true },
    });

    const markedStudentIds = new Set(existingRecords.map((r) => r.studentId));
    const unmarkedStudents = allStudents.filter((s) => !markedStudentIds.has(s.id));

    if (unmarkedStudents.length > 0) {
      await prisma.attendanceRecord.createMany({
        data: unmarkedStudents.map((s) => ({
          sessionId,
          studentId: s.id,
          status: finalizeUnmarkedStatus,
          method: 'MANUAL',
          remarks: 'Marked on session closure review',
          markedAt: new Date(),
        })),
      });
    }
  }

  const closedSession = await prisma.attendanceSession.update({
    where: { id: sessionId },
    data: {
      status: 'CLOSED',
      closedAt: new Date(),
    },
  });

  await logAudit({
    actorId,
    action: 'SESSION_CLOSED',
    entityType: 'AttendanceSession',
    entityId: sessionId,
    newValue: { closedAt: closedSession.closedAt, finalizeUnmarkedStatus },
  });

  return closedSession;
};

/**
 * Update an existing attendance record (Audit Logged correction)
 */
export const correctAttendanceRecord = async ({
  recordId,
  status,
  remarks,
  reason,
  schoolId,
  actorId,
}) => {
  const current = await prisma.attendanceRecord.findFirst({
    where: {
      id: recordId,
      session: { class: { schoolId } },
    },
    include: { student: true, session: true },
  });

  if (!current) {
    throw new Error('Attendance record not found.');
  }

  const updated = await prisma.attendanceRecord.update({
    where: { id: recordId },
    data: {
      status,
      remarks,
    },
  });

  await logAudit({
    actorId,
    action: 'ATTENDANCE_CORRECTED',
    entityType: 'AttendanceRecord',
    entityId: recordId,
    previousValue: { status: current.status, remarks: current.remarks },
    newValue: { status, remarks },
    reason: reason || 'Teacher manual correction',
  });

  return updated;
};

/**
 * List past sessions with filtering
 */
export const listSessions = async ({ schoolId, classId, teacherId, date, page = 1, limit = 20 }) => {
  const where = {
    class: { schoolId },
  };

  if (classId) where.classId = classId;
  if (teacherId) where.teacherId = teacherId;

  if (date) {
    const target = new Date(date);
    const start = new Date(target);
    start.setHours(0, 0, 0, 0);
    const end = new Date(target);
    end.setHours(23, 59, 59, 999);
    where.sessionDate = { gte: start, lte: end };
  }

  const skip = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
  const take = parseInt(limit, 10);

  const [total, sessions] = await Promise.all([
    prisma.attendanceSession.count({ where }),
    prisma.attendanceSession.findMany({
      where,
      include: {
        class: true,
        teacher: { select: { id: true, name: true, email: true } },
        _count: {
          select: { attendanceRecords: true },
        },
      },
      orderBy: { sessionDate: 'desc' },
      skip,
      take,
    }),
  ]);

  return {
    sessions,
    pagination: {
      total,
      page: parseInt(page, 10),
      limit: take,
      totalPages: Math.ceil(total / take),
    },
  };
};

