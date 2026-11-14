import bcrypt from 'bcryptjs';
import prisma from '../config/db.js';
import { logAudit } from './auditService.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validate teacher input attributes
 */
export const validateTeacherInput = ({ name, email, password, isUpdate = false }) => {
  if (!isUpdate || name !== undefined) {
    if (!name || typeof name !== 'string') {
      const err = new Error('Teacher name is required and must be a valid string.');
      err.statusCode = 400;
      throw err;
    }
    const trimmedName = name.trim();
    if (trimmedName.length < 2 || trimmedName.length > 100) {
      const err = new Error('Teacher name must be between 2 and 100 characters long.');
      err.statusCode = 400;
      throw err;
    }
  }

  if (!isUpdate || email !== undefined) {
    if (!email || typeof email !== 'string') {
      const err = new Error('Teacher email is required and must be a valid string.');
      err.statusCode = 400;
      throw err;
    }
    const trimmedEmail = email.trim().toLowerCase();
    if (!EMAIL_REGEX.test(trimmedEmail)) {
      const err = new Error(`Invalid email format: "${email}". Please provide a valid email address.`);
      err.statusCode = 400;
      throw err;
    }
  }

  if (password !== undefined && password !== null) {
    if (typeof password !== 'string' || password.length < 6) {
      const err = new Error('Password must be at least 6 characters long.');
      err.statusCode = 400;
      throw err;
    }
  }
};

/**
 * List teachers with optional search, filtering, and pagination
 */
export const listTeachers = async ({
  schoolId,
  search,
  status,
  classId,
  page,
  limit,
  sortBy = 'name',
  sortOrder = 'asc',
}) => {
  const where = {
    schoolId,
    role: 'TEACHER',
  };

  // Status filter: 'active', 'inactive', 'all', or boolean
  if (status !== undefined && status !== 'all') {
    if (status === 'active' || status === true || status === 'true') {
      where.active = true;
    } else if (status === 'inactive' || status === false || status === 'false') {
      where.active = false;
    }
  }

  // Class filter
  if (classId) {
    where.teacherAssignments = {
      some: { classId },
    };
  }

  // Search filter (name or email)
  if (search && typeof search === 'string' && search.trim()) {
    const term = search.trim();
    where.OR = [
      { name: { contains: term, mode: 'insensitive' } },
      { email: { contains: term, mode: 'insensitive' } },
    ];
  }

  // Ordering
  const allowedSortFields = ['name', 'email', 'createdAt'];
  const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'name';
  const order = sortOrder && sortOrder.toLowerCase() === 'desc' ? 'desc' : 'asc';
  const orderBy = { [sortField]: order };

  const selectFields = {
    id: true,
    name: true,
    email: true,
    active: true,
    createdAt: true,
    updatedAt: true,
    teacherAssignments: {
      select: {
        id: true,
        classId: true,
        isClassTeacher: true,
        assignedAt: true,
        class: {
          select: {
            id: true,
            name: true,
            section: true,
            academicYear: true,
          },
        },
      },
      orderBy: { class: { name: 'asc' } },
    },
    _count: {
      select: {
        attendanceSessions: true,
      },
    },
  };

  // If pagination is explicitly requested
  if (page !== undefined || limit !== undefined) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const [total, teachers] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        select: selectFields,
        orderBy,
        skip,
        take: limitNum,
      }),
    ]);

    const totalPages = Math.ceil(total / limitNum);

    return {
      teachers,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1,
      },
    };
  }

  // Otherwise return full list directly for backwards compatibility
  return await prisma.user.findMany({
    where,
    select: selectFields,
    orderBy,
  });
};

/**
 * Get single teacher by ID
 */
export const getTeacherById = async (id, schoolId) => {
  const teacher = await prisma.user.findFirst({
    where: { id, schoolId, role: 'TEACHER' },
    select: {
      id: true,
      name: true,
      email: true,
      active: true,
      createdAt: true,
      updatedAt: true,
      teacherAssignments: {
        select: {
          id: true,
          classId: true,
          isClassTeacher: true,
          assignedAt: true,
          class: {
            select: {
              id: true,
              name: true,
              section: true,
              academicYear: true,
            },
          },
        },
        orderBy: { class: { name: 'asc' } },
      },
      _count: {
        select: {
          attendanceSessions: true,
        },
      },
    },
  });

  if (!teacher) {
    const err = new Error('Teacher not found.');
    err.statusCode = 404;
    throw err;
  }

  return teacher;
};

/**
 * Normalize and validate class assignments payload
 */
const normalizeAssignmentsPayload = (assignedClassIds = [], assignments = []) => {
  const rawList = [];

  if (Array.isArray(assignments) && assignments.length > 0) {
    for (const item of assignments) {
      if (typeof item === 'string') {
        rawList.push({ classId: item, isClassTeacher: false });
      } else if (item && typeof item === 'object' && item.classId) {
        rawList.push({
          classId: item.classId,
          isClassTeacher: Boolean(item.isClassTeacher),
        });
      }
    }
  } else if (Array.isArray(assignedClassIds) && assignedClassIds.length > 0) {
    for (const item of assignedClassIds) {
      if (typeof item === 'string') {
        rawList.push({ classId: item, isClassTeacher: false });
      } else if (item && typeof item === 'object' && item.classId) {
        rawList.push({
          classId: item.classId,
          isClassTeacher: Boolean(item.isClassTeacher),
        });
      }
    }
  }

  // Deduplicate by classId, keeping isClassTeacher if any entry has it
  const map = new Map();
  for (const entry of rawList) {
    if (!entry.classId) continue;
    if (map.has(entry.classId)) {
      const existing = map.get(entry.classId);
      if (entry.isClassTeacher) existing.isClassTeacher = true;
    } else {
      map.set(entry.classId, { ...entry });
    }
  }

  return Array.from(map.values());
};

/**
 * Validate that classes exist and belong to school
 */
const validateSchoolClasses = async (classIds, schoolId) => {
  if (!classIds || classIds.length === 0) return [];

  const foundClasses = await prisma.class.findMany({
    where: {
      id: { in: classIds },
      schoolId,
    },
    select: { id: true, name: true, section: true },
  });

  if (foundClasses.length !== classIds.length) {
    const foundIds = new Set(foundClasses.map((c) => c.id));
    const missingIds = classIds.filter((cid) => !foundIds.has(cid));
    const err = new Error(
      `One or more class assignments are invalid: Class IDs [${missingIds.join(', ')}] do not exist in this school.`
    );
    err.statusCode = 400;
    throw err;
  }

  return foundClasses;
};

/**
 * Verify class teacher designations do not conflict with existing teachers
 */
const verifyClassTeacherUniqueness = async (assignments, schoolId, excludeTeacherId = null) => {
  const classTeacherAssignments = assignments.filter((a) => a.isClassTeacher);
  if (classTeacherAssignments.length === 0) return;

  const classIds = classTeacherAssignments.map((a) => a.classId);

  const existingClassTeachers = await prisma.teacherAssignment.findMany({
    where: {
      classId: { in: classIds },
      isClassTeacher: true,
      teacher: {
        schoolId,
        active: true,
        id: excludeTeacherId ? { not: excludeTeacherId } : undefined,
      },
    },
    include: {
      teacher: { select: { id: true, name: true } },
      class: { select: { id: true, name: true, section: true } },
    },
  });

  if (existingClassTeachers.length > 0) {
    const conflict = existingClassTeachers[0];
    const err = new Error(
      `Conflict! ${conflict.class.name}-${conflict.class.section} already has a designated Class Teacher: "${conflict.teacher.name}".`
    );
    err.statusCode = 409;
    throw err;
  }
};

/**
 * Create a new teacher
 */
export const createTeacher = async ({
  name,
  email,
  password,
  schoolId,
  assignedClassIds = [],
  assignments = [],
  actorId,
}) => {
  validateTeacherInput({ name, email, password, isUpdate: false });

  const normalizedEmail = email.toLowerCase().trim();
  const trimmedName = name.trim();

  const existing = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (existing) {
    const err = new Error(`A user with email address "${normalizedEmail}" already exists.`);
    err.statusCode = 409;
    throw err;
  }

  const normalizedAssignments = normalizeAssignmentsPayload(assignedClassIds, assignments);
  const classIds = normalizedAssignments.map((a) => a.classId);

  if (classIds.length > 0) {
    await validateSchoolClasses(classIds, schoolId);
    await verifyClassTeacherUniqueness(normalizedAssignments, schoolId);
  }

  const passwordHash = await bcrypt.hash(password || 'teacher123', 10);

  const teacher = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name: trimmedName,
        email: normalizedEmail,
        passwordHash,
        role: 'TEACHER',
        schoolId,
        active: true,
      },
    });

    if (normalizedAssignments.length > 0) {
      await tx.teacherAssignment.createMany({
        data: normalizedAssignments.map((a) => ({
          teacherId: user.id,
          classId: a.classId,
          isClassTeacher: Boolean(a.isClassTeacher),
        })),
      });
    }

    return user;
  });

  await logAudit({
    actorId,
    action: 'TEACHER_CREATED',
    entityType: 'User',
    entityId: teacher.id,
    newValue: {
      id: teacher.id,
      name: teacher.name,
      email: teacher.email,
      assignedClassesCount: normalizedAssignments.length,
    },
    reason: 'New teacher account created by administrator.',
  });

  return await getTeacherById(teacher.id, schoolId);
};

/**
 * Update teacher profile (name, email, password, active)
 */
export const updateTeacher = async (id, schoolId, updateData, actorId) => {
  const teacher = await getTeacherById(id, schoolId);

  const { name, email, password, active } = updateData;
  validateTeacherInput({ name, email, password, isUpdate: true });

  const dataToUpdate = {};

  if (name !== undefined) {
    dataToUpdate.name = name.trim();
  }

  if (email !== undefined) {
    const normalizedEmail = email.toLowerCase().trim();
    if (normalizedEmail !== teacher.email.toLowerCase()) {
      const emailConflict = await prisma.user.findUnique({
        where: { email: normalizedEmail },
      });
      if (emailConflict && emailConflict.id !== id) {
        const err = new Error(`Email address "${normalizedEmail}" is already in use by another user.`);
        err.statusCode = 409;
        throw err;
      }
      dataToUpdate.email = normalizedEmail;
    }
  }

  if (password !== undefined && password) {
    dataToUpdate.passwordHash = await bcrypt.hash(password, 10);
  }

  if (active !== undefined) {
    dataToUpdate.active = Boolean(active);
  }

  if (Object.keys(dataToUpdate).length === 0) {
    return teacher;
  }

  const updatedUser = await prisma.user.update({
    where: { id },
    data: dataToUpdate,
  });

  await logAudit({
    actorId,
    action: 'TEACHER_UPDATED',
    entityType: 'User',
    entityId: id,
    previousValue: {
      name: teacher.name,
      email: teacher.email,
      active: teacher.active,
    },
    newValue: {
      name: updatedUser.name,
      email: updatedUser.email,
      active: updatedUser.active,
      passwordChanged: Boolean(dataToUpdate.passwordHash),
    },
    reason: 'Teacher details updated by administrator.',
  });

  return await getTeacherById(id, schoolId);
};

/**
 * Bulk update/replace teacher class assignments
 */
export const updateTeacherAssignments = async (
  teacherId,
  schoolId,
  assignmentsInput = [],
  actorId
) => {
  const teacher = await getTeacherById(teacherId, schoolId);

  // Normalize assignment inputs (handles array of strings or array of objects)
  const normalizedAssignments = normalizeAssignmentsPayload(
    Array.isArray(assignmentsInput) ? assignmentsInput : [],
    Array.isArray(assignmentsInput) ? assignmentsInput : []
  );

  const classIds = normalizedAssignments.map((a) => a.classId);

  if (classIds.length > 0) {
    await validateSchoolClasses(classIds, schoolId);
    await verifyClassTeacherUniqueness(normalizedAssignments, schoolId, teacherId);
  }

  // Atomically replace all class assignments
  await prisma.$transaction(async (tx) => {
    await tx.teacherAssignment.deleteMany({
      where: { teacherId },
    });

    if (normalizedAssignments.length > 0) {
      await tx.teacherAssignment.createMany({
        data: normalizedAssignments.map((a) => ({
          teacherId,
          classId: a.classId,
          isClassTeacher: Boolean(a.isClassTeacher),
        })),
      });
    }
  });

  const previousClassIds = teacher.teacherAssignments.map((a) => a.classId);

  await logAudit({
    actorId,
    action: 'TEACHER_ASSIGNMENTS_UPDATED',
    entityType: 'User',
    entityId: teacherId,
    previousValue: previousClassIds,
    newValue: classIds,
    reason: 'Teacher class assignments updated by administrator.',
  });

  return await getTeacherById(teacherId, schoolId);
};

/**
 * Add a single class assignment to a teacher
 */
export const addTeacherAssignment = async (
  teacherId,
  schoolId,
  { classId, isClassTeacher = false },
  actorId
) => {
  if (!classId || typeof classId !== 'string') {
    const err = new Error('A valid classId is required for assignment.');
    err.statusCode = 400;
    throw err;
  }

  const teacher = await getTeacherById(teacherId, schoolId);

  const cls = await prisma.class.findFirst({
    where: { id: classId, schoolId },
    select: { id: true, name: true, section: true },
  });

  if (!cls) {
    const err = new Error('Class not found in this school.');
    err.statusCode = 404;
    throw err;
  }

  // Check if already assigned
  const existing = await prisma.teacherAssignment.findUnique({
    where: {
      teacherId_classId: {
        teacherId,
        classId,
      },
    },
  });

  if (existing) {
    const err = new Error(
      `Teacher "${teacher.name}" is already assigned to ${cls.name}-${cls.section}.`
    );
    err.statusCode = 400;
    throw err;
  }

  // If designated class teacher, verify uniqueness
  if (isClassTeacher) {
    await verifyClassTeacherUniqueness(
      [{ classId, isClassTeacher: true }],
      schoolId,
      teacherId
    );
  }

  await prisma.teacherAssignment.create({
    data: {
      teacherId,
      classId,
      isClassTeacher: Boolean(isClassTeacher),
    },
  });

  await logAudit({
    actorId,
    action: 'TEACHER_ASSIGNMENT_ADDED',
    entityType: 'TeacherAssignment',
    entityId: `${teacherId}_${classId}`,
    newValue: { teacherId, classId, isClassTeacher: Boolean(isClassTeacher) },
    reason: 'Class assigned to teacher.',
  });

  return await getTeacherById(teacherId, schoolId);
};

/**
 * Remove a single class assignment from a teacher
 */
export const removeTeacherAssignment = async (teacherId, schoolId, classId, actorId) => {
  await getTeacherById(teacherId, schoolId);

  const assignment = await prisma.teacherAssignment.findUnique({
    where: {
      teacherId_classId: {
        teacherId,
        classId,
      },
    },
    include: {
      class: { select: { id: true, name: true, section: true } },
    },
  });

  if (!assignment) {
    const err = new Error('Teacher is not currently assigned to this class.');
    err.statusCode = 404;
    throw err;
  }

  await prisma.teacherAssignment.delete({
    where: {
      teacherId_classId: {
        teacherId,
        classId,
      },
    },
  });

  await logAudit({
    actorId,
    action: 'TEACHER_ASSIGNMENT_REMOVED',
    entityType: 'TeacherAssignment',
    entityId: `${teacherId}_${classId}`,
    previousValue: {
      teacherId,
      classId,
      className: `${assignment.class.name}-${assignment.class.section}`,
    },
    reason: 'Class unassigned from teacher.',
  });

  return await getTeacherById(teacherId, schoolId);
};

/**
 * Get assigned classes and workload for a teacher
 */
export const getTeacherClasses = async (teacherId, schoolId) => {
  const teacher = await getTeacherById(teacherId, schoolId);

  const assignments = await prisma.teacherAssignment.findMany({
    where: { teacherId },
    include: {
      class: {
        include: {
          _count: {
            select: { students: true },
          },
        },
      },
    },
    orderBy: { class: { name: 'asc' } },
  });

  // Check today's active session for each class
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endOfDay = new Date(today);
  endOfDay.setHours(23, 59, 59, 999);

  const classIds = assignments.map((a) => a.classId);
  const todaysSessions = await prisma.attendanceSession.findMany({
    where: {
      classId: { in: classIds },
      sessionDate: { gte: today, lte: endOfDay },
    },
    select: {
      id: true,
      classId: true,
      status: true,
      teacherId: true,
    },
  });

  const sessionMap = new Map();
  for (const s of todaysSessions) {
    sessionMap.set(s.classId, s);
  }

  const classes = assignments.map((a) => {
    const currentSession = sessionMap.get(a.classId) || null;
    return {
      classId: a.classId,
      name: a.class.name,
      section: a.class.section,
      academicYear: a.class.academicYear,
      isClassTeacher: a.isClassTeacher,
      totalStudents: a.class._count.students,
      assignedAt: a.assignedAt,
      todaysSession: currentSession
        ? {
            sessionId: currentSession.id,
            status: currentSession.status,
            openedBySelf: currentSession.teacherId === teacherId,
          }
        : null,
    };
  });

  return {
    teacherId: teacher.id,
    teacherName: teacher.name,
    teacherEmail: teacher.email,
    active: teacher.active,
    totalAssignedClasses: classes.length,
    classes,
  };
};

/**
 * Delete or safely deactivate a teacher
 */
export const deleteTeacher = async (id, schoolId, actorId) => {
  const teacher = await getTeacherById(id, schoolId);

  const sessionCount = await prisma.attendanceSession.count({
    where: { teacherId: id },
  });

  // If teacher has conducted attendance sessions, do a safe deactivation
  if (sessionCount > 0) {
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: { active: false },
      });
      // Remove current class assignments so other teachers can take over
      await tx.teacherAssignment.deleteMany({
        where: { teacherId: id },
      });
    });

    await logAudit({
      actorId,
      action: 'TEACHER_DEACTIVATED',
      entityType: 'User',
      entityId: id,
      previousValue: { active: teacher.active, sessionCount },
      newValue: { active: false, assignmentsCleared: true },
      reason: 'Teacher deactivated due to historical attendance sessions.',
    });

    return {
      success: true,
      deactivated: true,
      message: `Teacher "${teacher.name}" has ${sessionCount} historical attendance sessions. Account was safely deactivated and class assignments were unassigned.`,
    };
  }

  // If no sessions, perform complete deletion
  await prisma.$transaction(async (tx) => {
    await tx.teacherAssignment.deleteMany({
      where: { teacherId: id },
    });
    await tx.user.delete({
      where: { id },
    });
  });

  await logAudit({
    actorId,
    action: 'TEACHER_DELETED',
    entityType: 'User',
    entityId: id,
    previousValue: { name: teacher.name, email: teacher.email },
    reason: 'Teacher account permanently deleted.',
  });

  return {
    success: true,
    deleted: true,
    message: `Teacher "${teacher.name}" deleted successfully.`,
  };
};

/**
 * Toggle teacher active status
 */
export const toggleTeacherStatus = async (id, schoolId, actorId) => {
  const teacher = await getTeacherById(id, schoolId);
  const updated = await prisma.user.update({
    where: { id },
    data: { active: !teacher.active },
  });

  await logAudit({
    actorId,
    action: 'TEACHER_STATUS_TOGGLED',
    entityType: 'User',
    entityId: id,
    previousValue: { active: teacher.active },
    newValue: { active: updated.active },
    reason: `Teacher account ${updated.active ? 'activated' : 'deactivated'}.`,
  });

  return await getTeacherById(id, schoolId);
};
