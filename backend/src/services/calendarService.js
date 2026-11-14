import prisma from '../config/db.js';
import { logAudit } from './auditService.js';

export const VALID_EVENT_TYPES = ['HOLIDAY', 'EXAM', 'EVENT', 'ACADEMIC'];

const createValidationError = (message) => {
  const err = new Error(message);
  err.statusCode = 400;
  return err;
};

/**
 * Validate academic calendar event input
 */
export const validateEventPayload = ({ title, type, startDate, endDate }) => {
  if (!title || typeof title !== 'string' || !title.trim()) {
    throw createValidationError('Event title is required.');
  }

  const normalizedType = type ? type.trim().toUpperCase() : 'EVENT';
  if (!VALID_EVENT_TYPES.includes(normalizedType)) {
    throw createValidationError(
      `Invalid event type "${type}". Allowed types: ${VALID_EVENT_TYPES.join(', ')}.`
    );
  }

  if (!startDate) {
    throw createValidationError('Start date is required.');
  }

  if (!endDate) {
    throw createValidationError('End date is required.');
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (isNaN(start.getTime())) {
    throw createValidationError('Invalid start date format.');
  }

  if (isNaN(end.getTime())) {
    throw createValidationError('Invalid end date format.');
  }

  if (start > end) {
    throw createValidationError('Start date cannot be after end date.');
  }

  return {
    normalizedTitle: title.trim(),
    normalizedType,
    start,
    end,
  };
};

/**
 * List academic events with optional date range or type filter
 */
export const listEvents = async ({ schoolId, startDate, endDate, type, isHoliday }) => {
  const where = { schoolId };

  if (type && VALID_EVENT_TYPES.includes(type.toUpperCase())) {
    where.type = type.toUpperCase();
  }

  if (isHoliday !== undefined) {
    where.isHoliday = isHoliday === 'true' || isHoliday === true;
  }

  if (startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
      where.OR = [
        {
          startDate: { lte: end },
          endDate: { gte: start },
        },
      ];
    }
  } else if (startDate) {
    const start = new Date(startDate);
    if (!isNaN(start.getTime())) {
      where.endDate = { gte: start };
    }
  } else if (endDate) {
    const end = new Date(endDate);
    if (!isNaN(end.getTime())) {
      where.startDate = { lte: end };
    }
  }

  const events = await prisma.academicEvent.findMany({
    where,
    orderBy: { startDate: 'asc' },
  });

  return events;
};

/**
 * Get single event by ID
 */
export const getEventById = async (id, schoolId) => {
  const event = await prisma.academicEvent.findFirst({
    where: { id, schoolId },
  });

  if (!event) {
    const err = new Error('Academic event not found.');
    err.statusCode = 404;
    throw err;
  }

  return event;
};

/**
 * Create a new academic calendar event
 */
export const createEvent = async ({
  schoolId,
  title,
  description = null,
  type = 'EVENT',
  startDate,
  endDate,
  isHoliday = false,
  actorId,
}) => {
  const { normalizedTitle, normalizedType, start, end } = validateEventPayload({
    title,
    type,
    startDate,
    endDate,
  });

  // Check for duplicate title on the same start date
  const duplicate = await prisma.academicEvent.findFirst({
    where: {
      schoolId,
      title: normalizedTitle,
      startDate: start,
    },
  });

  if (duplicate) {
    const err = new Error(
      `An event titled "${normalizedTitle}" is already scheduled on this start date.`
    );
    err.statusCode = 409;
    throw err;
  }

  const event = await prisma.academicEvent.create({
    data: {
      schoolId,
      title: normalizedTitle,
      description: description ? description.trim() : null,
      type: normalizedType,
      startDate: start,
      endDate: end,
      isHoliday: Boolean(isHoliday || normalizedType === 'HOLIDAY'),
    },
  });

  await logAudit({
    actorId,
    action: 'ACADEMIC_EVENT_CREATED',
    entityType: 'AcademicEvent',
    entityId: event.id,
    newValue: {
      title: event.title,
      type: event.type,
      startDate: event.startDate,
      endDate: event.endDate,
    },
  });

  return event;
};

/**
 * Update an existing academic event
 */
export const updateEvent = async (id, schoolId, updateData, actorId) => {
  const existing = await getEventById(id, schoolId);

  const title = updateData.title !== undefined ? updateData.title : existing.title;
  const type = updateData.type !== undefined ? updateData.type : existing.type;
  const startDate = updateData.startDate !== undefined ? updateData.startDate : existing.startDate;
  const endDate = updateData.endDate !== undefined ? updateData.endDate : existing.endDate;
  const description =
    updateData.description !== undefined ? updateData.description : existing.description;
  const isHoliday =
    updateData.isHoliday !== undefined ? updateData.isHoliday : existing.isHoliday;

  const { normalizedTitle, normalizedType, start, end } = validateEventPayload({
    title,
    type,
    startDate,
    endDate,
  });

  const updated = await prisma.academicEvent.update({
    where: { id },
    data: {
      title: normalizedTitle,
      description: description ? description.trim() : null,
      type: normalizedType,
      startDate: start,
      endDate: end,
      isHoliday: Boolean(isHoliday || normalizedType === 'HOLIDAY'),
    },
  });

  await logAudit({
    actorId,
    action: 'ACADEMIC_EVENT_UPDATED',
    entityType: 'AcademicEvent',
    entityId: id,
    previousValue: {
      title: existing.title,
      type: existing.type,
      startDate: existing.startDate,
      endDate: existing.endDate,
    },
    newValue: {
      title: updated.title,
      type: updated.type,
      startDate: updated.startDate,
      endDate: updated.endDate,
    },
  });

  return updated;
};

/**
 * Delete an academic event
 */
export const deleteEvent = async (id, schoolId, actorId) => {
  const existing = await getEventById(id, schoolId);

  await prisma.academicEvent.delete({
    where: { id },
  });

  await logAudit({
    actorId,
    action: 'ACADEMIC_EVENT_DELETED',
    entityType: 'AcademicEvent',
    entityId: id,
    previousValue: {
      title: existing.title,
      type: existing.type,
      startDate: existing.startDate,
      endDate: existing.endDate,
    },
  });

  return { id, message: 'Academic event deleted successfully.' };
};
