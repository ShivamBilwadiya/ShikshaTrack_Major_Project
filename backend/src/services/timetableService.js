import prisma from '../config/db.js';
import { logAudit } from './auditService.js';

export const VALID_DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * Convert "HH:mm" time string to minutes from midnight
 */
export const timeToMinutes = (timeStr) => {
  if (!timeStr || typeof timeStr !== 'string' || !TIME_REGEX.test(timeStr.trim())) {
    return null;
  }
  const [hours, minutes] = timeStr.trim().split(':').map(Number);
  return hours * 60 + minutes;
};

/**
 * Format minutes from midnight to "HH:mm" string
 */
export const minutesToTime = (minutes) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

/**
 * Check if two time intervals [startA, endA) and [startB, endB) overlap
 */
export const isTimeOverlapping = (startA, endA, startB, endB) => {
  const aStart = timeToMinutes(startA);
  const aEnd = timeToMinutes(endA);
  const bStart = timeToMinutes(startB);
  const bEnd = timeToMinutes(endB);

  if (aStart === null || aEnd === null || bStart === null || bEnd === null) {
    return false;
  }
  return aStart < bEnd && aEnd > bStart;
};

const createValidationError = (message) => {
  const err = new Error(message);
  err.statusCode = 400;
  return err;
};

/**
 * Validate timetable payload fields
 */
export const validateTimetablePayload = ({
  subject,
  dayOfWeek,
  startTime,
  endTime,
  classId,
  teacherId,
}) => {
  if (!subject || typeof subject !== 'string' || !subject.trim()) {
    throw createValidationError('Subject name is required.');
  }

  if (!classId || typeof classId !== 'string') {
    throw createValidationError('Valid classId is required.');
  }

  if (!teacherId || typeof teacherId !== 'string') {
    throw createValidationError('Valid teacherId is required.');
  }

  const normalizedDay = dayOfWeek ? dayOfWeek.trim().toUpperCase() : '';
  if (!VALID_DAYS.includes(normalizedDay)) {
    throw createValidationError(
      `Invalid dayOfWeek "${dayOfWeek}". Permitted days are: ${VALID_DAYS.join(', ')}.`
    );
  }

  const startMin = timeToMinutes(startTime);
  const endMin = timeToMinutes(endTime);

  if (startMin === null) {
    throw createValidationError(`Invalid startTime "${startTime}". Expected 24-hour HH:mm format (e.g. "09:00").`);
  }

  if (endMin === null) {
    throw createValidationError(`Invalid endTime "${endTime}". Expected 24-hour HH:mm format (e.g. "10:30").`);
  }

  if (startMin >= endMin) {
    throw createValidationError(`startTime (${startTime}) must be strictly earlier than endTime (${endTime}).`);
  }

  if (endMin - startMin < 15) {
    throw createValidationError('Timetable slot duration must be at least 15 minutes.');
  }

  return {
    normalizedDay,
    normalizedStart: startTime.trim(),
    normalizedEnd: endTime.trim(),
    normalizedSubject: subject.trim(),
  };
};

/**
 * Check for scheduling conflicts against existing entries:
 * 1. Teacher conflict: Teacher cannot have overlapping classes.
 * 2. Class conflict: Class cannot have two simultaneous lessons.
 * 3. Room conflict: Classroom cannot be double-booked.
 */
export const detectSchedulingConflicts = async ({
  schoolId,
  dayOfWeek,
  startTime,
  endTime,
  classId,
  teacherId,
  roomNumber = null,
  excludeEntryId = null,
}) => {
  // Query all entries for the same school and day
  const existingEntries = await prisma.timetableEntry.findMany({
    where: {
      schoolId,
      dayOfWeek,
      ...(excludeEntryId ? { id: { not: excludeEntryId } } : {}),
    },
    include: {
      class: {
        select: { id: true, name: true, section: true },
      },
      teacher: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  const conflicts = [];

  for (const entry of existingEntries) {
    if (!isTimeOverlapping(startTime, endTime, entry.startTime, entry.endTime)) {
      continue;
    }

    // 1. Teacher Overlap Check
    if (entry.teacherId === teacherId) {
      conflicts.push({
        type: 'TEACHER_CONFLICT',
        message: `Teacher ${entry.teacher.name} is already scheduled for ${entry.subject} in ${entry.class.name} (${entry.class.section}) from ${entry.startTime} to ${entry.endTime}.`,
        conflictingEntry: {
          id: entry.id,
          subject: entry.subject,
          dayOfWeek: entry.dayOfWeek,
          startTime: entry.startTime,
          endTime: entry.endTime,
          teacherName: entry.teacher.name,
          className: `${entry.class.name} (${entry.class.section})`,
        },
      });
    }

    // 2. Class Overlap Check
    if (entry.classId === classId) {
      conflicts.push({
        type: 'CLASS_CONFLICT',
        message: `Class ${entry.class.name} (${entry.class.section}) already has ${entry.subject} scheduled from ${entry.startTime} to ${entry.endTime} with ${entry.teacher.name}.`,
        conflictingEntry: {
          id: entry.id,
          subject: entry.subject,
          dayOfWeek: entry.dayOfWeek,
          startTime: entry.startTime,
          endTime: entry.endTime,
          teacherName: entry.teacher.name,
          className: `${entry.class.name} (${entry.class.section})`,
        },
      });
    }

    // 3. Room Overlap Check (if room number provided)
    if (
      roomNumber &&
      entry.roomNumber &&
      roomNumber.trim().toLowerCase() === entry.roomNumber.trim().toLowerCase()
    ) {
      conflicts.push({
        type: 'ROOM_CONFLICT',
        message: `Classroom "${entry.roomNumber}" is already booked for ${entry.subject} (${entry.class.name}-${entry.class.section}) from ${entry.startTime} to ${entry.endTime}.`,
        conflictingEntry: {
          id: entry.id,
          subject: entry.subject,
          roomNumber: entry.roomNumber,
          startTime: entry.startTime,
          endTime: entry.endTime,
          className: `${entry.class.name} (${entry.class.section})`,
        },
      });
    }
  }

  return conflicts;
};

/**
 * List timetable entries with flexible filtering
 */
export const listTimetableEntries = async ({
  schoolId,
  classId,
  teacherId,
  dayOfWeek,
  academicYear,
  subject,
  search,
}) => {
  const where = { schoolId };

  if (classId) where.classId = classId;
  if (teacherId) where.teacherId = teacherId;
  if (dayOfWeek && VALID_DAYS.includes(dayOfWeek.toUpperCase())) {
    where.dayOfWeek = dayOfWeek.toUpperCase();
  }
  if (academicYear) where.academicYear = academicYear;
  if (subject) {
    where.subject = { contains: subject, mode: 'insensitive' };
  }
  if (search) {
    where.OR = [
      { subject: { contains: search, mode: 'insensitive' } },
      { roomNumber: { contains: search, mode: 'insensitive' } },
      { teacher: { name: { contains: search, mode: 'insensitive' } } },
      { class: { name: { contains: search, mode: 'insensitive' } } },
    ];
  }

  const entries = await prisma.timetableEntry.findMany({
    where,
    include: {
      class: {
        select: {
          id: true,
          name: true,
          section: true,
          academicYear: true,
        },
      },
      teacher: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      },
    },
    orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
  });

  return entries;
};

/**
 * Retrieve weekly timetable grid structured by day (MONDAY to SATURDAY)
 */
export const getWeeklyTimetableGrid = async ({
  schoolId,
  classId = null,
  teacherId = null,
  academicYear = null,
}) => {
  const entries = await listTimetableEntries({
    schoolId,
    classId,
    teacherId,
    academicYear,
  });

  const grid = {
    MONDAY: [],
    TUESDAY: [],
    WEDNESDAY: [],
    THURSDAY: [],
    FRIDAY: [],
    SATURDAY: [],
  };

  entries.forEach((entry) => {
    if (grid[entry.dayOfWeek]) {
      grid[entry.dayOfWeek].push(entry);
    }
  });

  // Calculate summary metrics
  const uniqueSubjects = new Set(entries.map((e) => e.subject));
  const uniqueTeachers = new Set(entries.map((e) => e.teacherId));
  const uniqueClasses = new Set(entries.map((e) => e.classId));

  // Determine earliest and latest period slots across the week
  let earliestStart = null;
  let latestEnd = null;

  entries.forEach((e) => {
    const sMin = timeToMinutes(e.startTime);
    const eMin = timeToMinutes(e.endTime);
    if (earliestStart === null || sMin < earliestStart) earliestStart = sMin;
    if (latestEnd === null || eMin > latestEnd) latestEnd = eMin;
  });

  return {
    grid,
    summary: {
      totalEntries: entries.length,
      subjectCount: uniqueSubjects.size,
      teacherCount: uniqueTeachers.size,
      classCount: uniqueClasses.size,
      earliestTime: earliestStart !== null ? minutesToTime(earliestStart) : '08:00',
      latestTime: latestEnd !== null ? minutesToTime(latestEnd) : '15:00',
      filter: {
        classId,
        teacherId,
        academicYear,
      },
    },
  };
};

/**
 * Get single timetable entry by ID
 */
export const getTimetableEntryById = async (id, schoolId) => {
  const entry = await prisma.timetableEntry.findFirst({
    where: { id, schoolId },
    include: {
      class: {
        select: {
          id: true,
          name: true,
          section: true,
          academicYear: true,
        },
      },
      teacher: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      },
    },
  });

  if (!entry) {
    const err = new Error('Timetable entry not found.');
    err.statusCode = 404;
    throw err;
  }

  return entry;
};

/**
 * Create a new timetable entry with conflict verification
 */
export const createTimetableEntry = async ({
  schoolId,
  classId,
  teacherId,
  subject,
  dayOfWeek,
  startTime,
  endTime,
  roomNumber = null,
  academicYear = null,
  notes = null,
  actorId,
}) => {
  const { normalizedDay, normalizedStart, normalizedEnd, normalizedSubject } =
    validateTimetablePayload({
      subject,
      dayOfWeek,
      startTime,
      endTime,
      classId,
      teacherId,
    });

  // Verify class belongs to the school
  const targetClass = await prisma.class.findFirst({
    where: { id: classId, schoolId },
  });
  if (!targetClass) {
    const err = new Error('The specified class does not exist in this school.');
    err.statusCode = 404;
    throw err;
  }

  // Verify teacher belongs to the school
  const targetTeacher = await prisma.user.findFirst({
    where: { id: teacherId, schoolId, active: true },
  });
  if (!targetTeacher) {
    const err = new Error('The specified teacher does not exist or is inactive.');
    err.statusCode = 404;
    throw err;
  }

  // Check for scheduling conflicts
  const conflicts = await detectSchedulingConflicts({
    schoolId,
    dayOfWeek: normalizedDay,
    startTime: normalizedStart,
    endTime: normalizedEnd,
    classId,
    teacherId,
    roomNumber: roomNumber ? roomNumber.trim() : null,
  });

  if (conflicts.length > 0) {
    const err = new Error(conflicts[0].message);
    err.statusCode = 409;
    err.conflicts = conflicts;
    throw err;
  }

  const created = await prisma.timetableEntry.create({
    data: {
      schoolId,
      classId,
      teacherId,
      subject: normalizedSubject,
      dayOfWeek: normalizedDay,
      startTime: normalizedStart,
      endTime: normalizedEnd,
      roomNumber: roomNumber ? roomNumber.trim() : null,
      academicYear: academicYear || targetClass.academicYear,
      notes: notes ? notes.trim() : null,
    },
    include: {
      class: {
        select: { id: true, name: true, section: true },
      },
      teacher: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  await logAudit({
    actorId,
    action: 'TIMETABLE_ENTRY_CREATED',
    entityType: 'TimetableEntry',
    entityId: created.id,
    newValue: {
      subject: created.subject,
      day: created.dayOfWeek,
      startTime: created.startTime,
      endTime: created.endTime,
      class: `${created.class.name}-${created.class.section}`,
      teacher: created.teacher.name,
      roomNumber: created.roomNumber,
    },
  });

  return created;
};

/**
 * Update an existing timetable entry
 */
export const updateTimetableEntry = async (id, schoolId, updateData, actorId) => {
  const existing = await getTimetableEntryById(id, schoolId);

  const subject = updateData.subject ?? existing.subject;
  const dayOfWeek = updateData.dayOfWeek ?? existing.dayOfWeek;
  const startTime = updateData.startTime ?? existing.startTime;
  const endTime = updateData.endTime ?? existing.endTime;
  const classId = updateData.classId ?? existing.classId;
  const teacherId = updateData.teacherId ?? existing.teacherId;
  const roomNumber = updateData.roomNumber !== undefined ? updateData.roomNumber : existing.roomNumber;
  const academicYear = updateData.academicYear !== undefined ? updateData.academicYear : existing.academicYear;
  const notes = updateData.notes !== undefined ? updateData.notes : existing.notes;

  const { normalizedDay, normalizedStart, normalizedEnd, normalizedSubject } =
    validateTimetablePayload({
      subject,
      dayOfWeek,
      startTime,
      endTime,
      classId,
      teacherId,
    });

  // Verify class
  if (classId !== existing.classId) {
    const cls = await prisma.class.findFirst({ where: { id: classId, schoolId } });
    if (!cls) {
      const err = new Error('The specified class does not exist.');
      err.statusCode = 404;
      throw err;
    }
  }

  // Verify teacher
  if (teacherId !== existing.teacherId) {
    const tchr = await prisma.user.findFirst({ where: { id: teacherId, schoolId, active: true } });
    if (!tchr) {
      const err = new Error('The specified teacher does not exist.');
      err.statusCode = 404;
      throw err;
    }
  }

  // Check conflicts excluding current entry
  const conflicts = await detectSchedulingConflicts({
    schoolId,
    dayOfWeek: normalizedDay,
    startTime: normalizedStart,
    endTime: normalizedEnd,
    classId,
    teacherId,
    roomNumber: roomNumber ? roomNumber.trim() : null,
    excludeEntryId: id,
  });

  if (conflicts.length > 0) {
    const err = new Error(conflicts[0].message);
    err.statusCode = 409;
    err.conflicts = conflicts;
    throw err;
  }

  const updated = await prisma.timetableEntry.update({
    where: { id },
    data: {
      classId,
      teacherId,
      subject: normalizedSubject,
      dayOfWeek: normalizedDay,
      startTime: normalizedStart,
      endTime: normalizedEnd,
      roomNumber: roomNumber ? roomNumber.trim() : null,
      academicYear,
      notes: notes ? notes.trim() : null,
    },
    include: {
      class: { select: { id: true, name: true, section: true } },
      teacher: { select: { id: true, name: true, email: true } },
    },
  });

  await logAudit({
    actorId,
    action: 'TIMETABLE_ENTRY_UPDATED',
    entityType: 'TimetableEntry',
    entityId: id,
    previousValue: {
      subject: existing.subject,
      dayOfWeek: existing.dayOfWeek,
      startTime: existing.startTime,
      endTime: existing.endTime,
    },
    newValue: {
      subject: updated.subject,
      dayOfWeek: updated.dayOfWeek,
      startTime: updated.startTime,
      endTime: updated.endTime,
    },
  });

  return updated;
};

/**
 * Delete a timetable entry
 */
export const deleteTimetableEntry = async (id, schoolId, actorId) => {
  const existing = await getTimetableEntryById(id, schoolId);

  await prisma.timetableEntry.delete({
    where: { id },
  });

  await logAudit({
    actorId,
    action: 'TIMETABLE_ENTRY_DELETED',
    entityType: 'TimetableEntry',
    entityId: id,
    previousValue: {
      subject: existing.subject,
      dayOfWeek: existing.dayOfWeek,
      startTime: existing.startTime,
      endTime: existing.endTime,
      classId: existing.classId,
      teacherId: existing.teacherId,
    },
  });

  return { id, message: 'Timetable entry deleted successfully.' };
};

/**
 * Validate a proposed slot before saving (live conflict check endpoint)
 */
export const checkSlotConflict = async ({
  schoolId,
  classId,
  teacherId,
  dayOfWeek,
  startTime,
  endTime,
  roomNumber = null,
  excludeEntryId = null,
}) => {
  try {
    const { normalizedDay, normalizedStart, normalizedEnd } = validateTimetablePayload({
      subject: 'Temporary Validation',
      dayOfWeek,
      startTime,
      endTime,
      classId,
      teacherId,
    });

    const conflicts = await detectSchedulingConflicts({
      schoolId,
      dayOfWeek: normalizedDay,
      startTime: normalizedStart,
      endTime: normalizedEnd,
      classId,
      teacherId,
      roomNumber: roomNumber ? roomNumber.trim() : null,
      excludeEntryId,
    });

    return {
      isValid: conflicts.length === 0,
      conflicts,
    };
  } catch (err) {
    return {
      isValid: false,
      validationError: err.message,
      conflicts: [],
    };
  }
};
