import prisma from '../config/db.js';

export const INCIDENT_CATEGORIES = ['BEHAVIOUR', 'ATTENDANCE', 'ACADEMIC', 'SAFETY', 'OTHER'];
export const INCIDENT_SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
export const INCIDENT_STATUSES = ['REPORTED', 'UNDER_INVESTIGATION', 'RESOLVED', 'CLOSED'];

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
    console.error('Failed to write incident audit log:', err.message);
  }
};

/**
 * Record a new student incident
 */
export const recordIncident = async ({
  schoolId,
  studentId,
  classId,
  reportedById = null,
  title,
  description,
  incidentDate = new Date(),
  category = 'BEHAVIOUR',
  severity = 'MEDIUM',
  isPrivate = false,
  actionTaken = null,
}) => {
  if (!studentId) {
    throw new Error('Student ID is required.');
  }
  if (!title || !title.trim()) {
    throw new Error('Incident title is required.');
  }
  if (!description || !description.trim()) {
    throw new Error('Incident description is required.');
  }
  if (!INCIDENT_CATEGORIES.includes(category)) {
    throw new Error(`Invalid incident category "${category}". Allowed: ${INCIDENT_CATEGORIES.join(', ')}`);
  }
  if (!INCIDENT_SEVERITIES.includes(severity)) {
    throw new Error(`Invalid incident severity "${severity}". Allowed: ${INCIDENT_SEVERITIES.join(', ')}`);
  }

  const student = await prisma.student.findFirst({
    where: { id: studentId, schoolId },
    include: { class: true },
  });

  if (!student) {
    throw new Error('Student not found in this school.');
  }

  const resolvedClassId = classId || student.classId;
  const parsedDate = incidentDate ? new Date(incidentDate) : new Date();

  const [incident] = await prisma.$transaction([
    prisma.studentIncident.create({
      data: {
        schoolId,
        studentId,
        classId: resolvedClassId,
        reportedById,
        title: title.trim(),
        description: description.trim(),
        incidentDate: parsedDate,
        category,
        severity,
        status: 'REPORTED',
        actionTaken: actionTaken ? actionTaken.trim() : null,
        isPrivate: Boolean(isPrivate),
      },
      include: {
        student: { select: { id: true, name: true, admissionNumber: true, rollNumber: true } },
        class: { select: { id: true, name: true, section: true } },
        reportedBy: { select: { id: true, name: true, role: true } },
      },
    }),
  ]);

  // Record initial history
  await prisma.incidentActionHistory.create({
    data: {
      incidentId: incident.id,
      actorId: reportedById,
      action: 'REPORTED',
      notes: `Incident reported with severity "${severity}" in category "${category}". Initial action: ${actionTaken || 'None recorded'}.`,
    },
  });

  await logAudit({
    actorId: reportedById,
    action: 'INCIDENT_REPORTED',
    entityType: 'StudentIncident',
    entityId: incident.id,
    newValue: {
      studentId,
      category,
      severity,
      title: title.trim(),
      isPrivate: Boolean(isPrivate),
    },
    reason: `Discipline/Behaviour incident recorded for ${student.name}`,
  });

  return incident;
};

/**
 * List incidents with search and role-based privacy scoping
 */
export const listIncidents = async ({
  schoolId,
  userRole = 'TEACHER',
  userId = null,
  classId,
  studentId,
  category,
  severity,
  status,
  search,
  page = 1,
  limit = 20,
}) => {
  const where = { schoolId };

  // Role privacy: Non-admins cannot see private administrative incident notes unless they reported them
  if (userRole !== 'ADMIN') {
    where.OR = [
      { isPrivate: false },
      { reportedById: userId || '' },
    ];
  }

  if (classId) {
    where.classId = classId;
  }

  if (studentId) {
    where.studentId = studentId;
  }

  if (category) {
    where.category = category;
  }

  if (severity) {
    where.severity = severity;
  }

  if (status) {
    where.status = status;
  }

  if (search && search.trim()) {
    const q = search.trim();
    const searchFilter = [
      { title: { contains: q, mode: 'insensitive' } },
      { description: { contains: q, mode: 'insensitive' } },
      { student: { name: { contains: q, mode: 'insensitive' } } },
      { student: { admissionNumber: { contains: q, mode: 'insensitive' } } },
    ];

    if (where.OR) {
      where.AND = [{ OR: where.OR }, { OR: searchFilter }];
      delete where.OR;
    } else {
      where.OR = searchFilter;
    }
  }

  const p = Math.max(1, parseInt(page, 10) || 1);
  const l = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (p - 1) * l;

  const [total, incidents] = await Promise.all([
    prisma.studentIncident.count({ where }),
    prisma.studentIncident.findMany({
      where,
      skip,
      take: l,
      orderBy: [{ incidentDate: 'desc' }, { createdAt: 'desc' }],
      include: {
        student: { select: { id: true, name: true, admissionNumber: true, rollNumber: true } },
        class: { select: { id: true, name: true, section: true } },
        reportedBy: { select: { id: true, name: true, role: true } },
        resolvedBy: { select: { id: true, name: true, role: true } },
        history: {
          orderBy: { timestamp: 'desc' },
          take: 3,
          include: { actor: { select: { id: true, name: true, role: true } } },
        },
      },
    }),
  ]);

  return {
    incidents,
    pagination: {
      total,
      page: p,
      limit: l,
      totalPages: Math.ceil(total / l) || 1,
    },
  };
};

/**
 * Get incident details by ID
 */
export const getIncidentById = async (incidentId, schoolId, userRole = 'TEACHER', userId = null) => {
  const incident = await prisma.studentIncident.findFirst({
    where: { id: incidentId, schoolId },
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
      class: { select: { id: true, name: true, section: true, academicYear: true } },
      reportedBy: { select: { id: true, name: true, role: true, email: true } },
      resolvedBy: { select: { id: true, name: true, role: true, email: true } },
      history: {
        orderBy: { timestamp: 'asc' },
        include: { actor: { select: { id: true, name: true, role: true } } },
      },
    },
  });

  if (!incident) {
    throw new Error('Student incident record not found.');
  }

  if (incident.isPrivate && userRole !== 'ADMIN' && incident.reportedById !== userId) {
    throw new Error('Access denied: This incident record contains confidential administrative notes.');
  }

  return incident;
};

/**
 * Update incident status, record action taken and resolution notes
 */
export const updateIncidentStatus = async ({
  incidentId,
  schoolId,
  actorId,
  userRole = 'TEACHER',
  status,
  actionTaken,
  resolutionNotes,
  isPrivate,
}) => {
  if (status && !INCIDENT_STATUSES.includes(status)) {
    throw new Error(`Invalid status "${status}". Allowed: ${INCIDENT_STATUSES.join(', ')}`);
  }

  const existing = await prisma.studentIncident.findFirst({
    where: { id: incidentId, schoolId },
    include: { student: true },
  });

  if (!existing) {
    throw new Error('Student incident not found.');
  }

  // Teacher restriction on private incidents
  if (existing.isPrivate && userRole !== 'ADMIN' && existing.reportedById !== actorId) {
    throw new Error('Unauthorized to modify this private administrative incident.');
  }

  const newStatus = status || existing.status;
  const isResolving = (newStatus === 'RESOLVED' || newStatus === 'CLOSED') && existing.status !== newStatus;

  const updateData = {
    status: newStatus,
    updatedAt: new Date(),
  };

  if (actionTaken !== undefined) {
    updateData.actionTaken = actionTaken ? actionTaken.trim() : null;
  }

  if (resolutionNotes !== undefined) {
    updateData.resolutionNotes = resolutionNotes ? resolutionNotes.trim() : null;
  }

  if (isPrivate !== undefined && userRole === 'ADMIN') {
    updateData.isPrivate = Boolean(isPrivate);
  }

  if (isResolving) {
    updateData.resolvedAt = new Date();
    updateData.resolvedById = actorId;
  }

  const [updatedIncident, actionHistory] = await prisma.$transaction([
    prisma.studentIncident.update({
      where: { id: incidentId },
      data: updateData,
      include: {
        student: { select: { id: true, name: true, admissionNumber: true } },
        class: { select: { id: true, name: true, section: true } },
        reportedBy: { select: { id: true, name: true, role: true } },
        resolvedBy: { select: { id: true, name: true, role: true } },
        history: {
          orderBy: { timestamp: 'desc' },
          include: { actor: { select: { id: true, name: true, role: true } } },
        },
      },
    }),
    prisma.incidentActionHistory.create({
      data: {
        incidentId,
        actorId,
        action: isResolving ? 'RESOLVED' : 'STATUS_UPDATED',
        notes: `Status changed from ${existing.status} to ${newStatus}.${
          actionTaken ? ` Action taken: ${actionTaken}.` : ''
        }${resolutionNotes ? ` Resolution notes: ${resolutionNotes}.` : ''}`,
      },
    }),
  ]);

  await logAudit({
    actorId,
    action: isResolving ? 'INCIDENT_RESOLVED' : 'INCIDENT_UPDATED',
    entityType: 'StudentIncident',
    entityId: incidentId,
    previousValue: { status: existing.status, actionTaken: existing.actionTaken },
    newValue: { status: newStatus, actionTaken: updateData.actionTaken },
    reason: `Incident status updated to ${newStatus}`,
  });

  return updatedIncident;
};

/**
 * Add standalone action note to incident timeline
 */
export const addIncidentAction = async ({ incidentId, schoolId, actorId, action, notes }) => {
  if (!notes || !notes.trim()) {
    throw new Error('Action note content is required.');
  }

  const incident = await prisma.studentIncident.findFirst({
    where: { id: incidentId, schoolId },
  });

  if (!incident) {
    throw new Error('Student incident not found.');
  }

  const history = await prisma.incidentActionHistory.create({
    data: {
      incidentId,
      actorId,
      action: action || 'NOTE_ADDED',
      notes: notes.trim(),
    },
    include: {
      actor: { select: { id: true, name: true, role: true } },
    },
  });

  return history;
};

/**
 * Get incident summaries and statistics
 */
export const getIncidentSummary = async ({ schoolId, classId, startDate, endDate }) => {
  const where = { schoolId };
  if (classId) where.classId = classId;
  if (startDate || endDate) {
    where.incidentDate = {};
    if (startDate) where.incidentDate.gte = new Date(startDate);
    if (endDate) where.incidentDate.lte = new Date(endDate);
  }

  const incidents = await prisma.studentIncident.findMany({
    where,
    select: {
      id: true,
      category: true,
      severity: true,
      status: true,
      incidentDate: true,
    },
  });

  const summary = {
    totalIncidents: incidents.length,
    activeIncidents: 0,
    resolvedIncidents: 0,
    criticalIncidents: 0,
    byCategory: {
      BEHAVIOUR: 0,
      ATTENDANCE: 0,
      ACADEMIC: 0,
      SAFETY: 0,
      OTHER: 0,
    },
    bySeverity: {
      LOW: 0,
      MEDIUM: 0,
      HIGH: 0,
      CRITICAL: 0,
    },
    byStatus: {
      REPORTED: 0,
      UNDER_INVESTIGATION: 0,
      RESOLVED: 0,
      CLOSED: 0,
    },
  };

  incidents.forEach((i) => {
    if (i.status === 'REPORTED' || i.status === 'UNDER_INVESTIGATION') {
      summary.activeIncidents++;
    } else {
      summary.resolvedIncidents++;
    }

    if (i.severity === 'CRITICAL' || i.severity === 'HIGH') {
      summary.criticalIncidents++;
    }

    if (summary.byCategory[i.category] !== undefined) summary.byCategory[i.category]++;
    if (summary.bySeverity[i.severity] !== undefined) summary.bySeverity[i.severity]++;
    if (summary.byStatus[i.status] !== undefined) summary.byStatus[i.status]++;
  });

  summary.resolutionRate =
    summary.totalIncidents > 0
      ? Math.round((summary.resolvedIncidents / summary.totalIncidents) * 100)
      : 0;

  return summary;
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
 * Export incidents to RFC-4180 CSV
 */
export const generateIncidentCsv = async ({ schoolId, userRole, userId, classId, category, severity, status }) => {
  const where = { schoolId };
  if (userRole !== 'ADMIN') {
    where.isPrivate = false;
  }
  if (classId) where.classId = classId;
  if (category) where.category = category;
  if (severity) where.severity = severity;
  if (status) where.status = status;

  const incidents = await prisma.studentIncident.findMany({
    where,
    orderBy: { incidentDate: 'desc' },
    include: {
      student: { select: { name: true, admissionNumber: true, rollNumber: true } },
      class: { select: { name: true, section: true } },
      reportedBy: { select: { name: true } },
      resolvedBy: { select: { name: true } },
    },
  });

  const headers = [
    'Incident ID',
    'Date',
    'Student Name',
    'Admission Number',
    'Roll Number',
    'Class',
    'Category',
    'Severity',
    'Status',
    'Title',
    'Description',
    'Action Taken',
    'Resolution Notes',
    'Reported By',
    'Resolved By',
  ];

  const rows = incidents.map((i) => [
    escapeCsvField(i.id),
    escapeCsvField(i.incidentDate.toISOString().split('T')[0]),
    escapeCsvField(i.student.name),
    escapeCsvField(i.student.admissionNumber),
    escapeCsvField(i.student.rollNumber || 'N/A'),
    escapeCsvField(`${i.class.name}-${i.class.section}`),
    escapeCsvField(i.category),
    escapeCsvField(i.severity),
    escapeCsvField(i.status),
    escapeCsvField(i.title),
    escapeCsvField(i.description),
    escapeCsvField(i.actionTaken || 'N/A'),
    escapeCsvField(i.resolutionNotes || 'N/A'),
    escapeCsvField(i.reportedBy ? i.reportedBy.name : 'System/Staff'),
    escapeCsvField(i.resolvedBy ? i.resolvedBy.name : 'Unresolved'),
  ]);

  return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
};
