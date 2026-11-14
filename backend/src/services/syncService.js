import prisma from '../config/db.js';
import { logAudit } from './auditService.js';

const VALID_STATUSES = ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'];
const MAX_AUTO_RETRIES = 5;

/**
 * Download offline class roster with active student QR credentials
 */
export const downloadRoster = async ({ classId, schoolId, teacherId }) => {
  const cls = await prisma.class.findFirst({
    where: { id: classId, schoolId },
    include: {
      students: {
        where: { active: true },
        select: { id: true, name: true, admissionNumber: true, rollNumber: true, qrToken: true, gender: true },
        orderBy: [{ rollNumber: 'asc' }, { name: 'asc' }],
      },
    },
  });

  if (!cls) {
    const err = new Error('Class not found.');
    err.statusCode = 404;
    throw err;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endOfDay = new Date(today);
  endOfDay.setHours(23, 59, 59, 999);

  let session = await prisma.attendanceSession.findFirst({
    where: { classId, sessionDate: { gte: today, lte: endOfDay } },
  });

  if (!session) {
    session = await prisma.attendanceSession.create({
      data: {
        classId,
        teacherId,
        sessionDate: new Date(),
        status: 'OPEN',
        notes: `Offline session for ${cls.name}-${cls.section}`,
      },
    });
  }

  return {
    class: { id: cls.id, name: cls.name, section: cls.section, academicYear: cls.academicYear },
    sessionId: session.id,
    sessionDate: session.sessionDate,
    downloadedAt: new Date().toISOString(),
    students: cls.students,
  };
};

/**
 * Synchronize batch offline attendance events with idempotency and conflict preservation
 */
export const syncBatch = async ({ schoolId, teacherId, events = [] }) => {
  if (!Array.isArray(events) || events.length === 0) {
    return { success: true, syncedCount: 0, duplicatesCount: 0, conflictsCount: 0, conflictsResolvedCount: 0, failedCount: 0, results: [] };
  }

  const results = [];
  let [syncedCount, duplicatesCount, conflictsCount, conflictsResolvedCount, failedCount] = [0, 0, 0, 0, 0];

  for (const event of events) {
    const opId = event.operationId || event.eventId || `auto-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const { sessionId, studentId, qrToken, status = 'PRESENT', timestamp, remarks } = event;

    // 1. Idempotency Check
    const existingOp = await prisma.syncOperation.findUnique({ where: { operationId: opId } });
    if (existingOp && existingOp.status === 'SYNCED') {
      duplicatesCount++;
      results.push({ operationId: opId, eventId: opId, success: true, isDuplicate: true, status: 'SYNCED', message: 'Already synchronized (idempotent).' });
      continue;
    }

    let syncOp = existingOp;
    if (!syncOp) {
      syncOp = await prisma.syncOperation.create({
        data: { schoolId, teacherId, operationId: opId, studentId: studentId || null, status: 'SYNCING', payload: event, retryCount: event.retryCount || 0 },
      });
    } else {
      syncOp = await prisma.syncOperation.update({
        where: { id: existingOp.id },
        data: { status: 'SYNCING', retryCount: existingOp.retryCount + 1, updatedAt: new Date() },
      });
    }

    try {
      // 2. Resolve Student
      let student = null;
      if (studentId) {
        student = await prisma.student.findFirst({ where: { id: studentId, schoolId, active: true } });
      } else if (qrToken) {
        student = await prisma.student.findFirst({ where: { qrToken, schoolId, active: true } });
      }

      if (!student) {
        failedCount++;
        const errorMsg = 'Student not found in this school.';
        await prisma.syncOperation.update({ where: { id: syncOp.id }, data: { status: 'FAILED', lastError: errorMsg } });
        results.push({ operationId: opId, eventId: opId, success: false, error: errorMsg });
        continue;
      }

      // 3. Resolve Session
      let targetSessionId = sessionId;
      if (!targetSessionId) {
        const eventDate = timestamp ? new Date(timestamp) : new Date();
        const start = new Date(eventDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(eventDate);
        end.setHours(23, 59, 59, 999);

        let session = await prisma.attendanceSession.findFirst({
          where: { classId: student.classId, sessionDate: { gte: start, lte: end } },
        });

        if (!session) {
          session = await prisma.attendanceSession.create({
            data: { classId: student.classId, teacherId, sessionDate: eventDate, status: 'OPEN', notes: 'Auto-created offline session' },
          });
        }
        targetSessionId = session.id;
      }

      // 4. Validate Status
      const targetStatus = status ? status.toUpperCase() : 'PRESENT';
      if (!VALID_STATUSES.includes(targetStatus)) {
        failedCount++;
        const errorMsg = `Invalid attendance status: "${status}". Supported values are: ${VALID_STATUSES.join(', ')}.`;
        await prisma.syncOperation.update({ where: { id: syncOp.id }, data: { status: 'FAILED', lastError: errorMsg } });
        results.push({ operationId: opId, eventId: opId, success: false, error: errorMsg });
        continue;
      }

      // 5. Check Existing Attendance Record & Handle Conflict
      const existingRecord = await prisma.attendanceRecord.findUnique({
        where: { sessionId_studentId: { sessionId: targetSessionId, studentId: student.id } },
      });

      if (existingRecord) {
        const isConflicting = existingRecord.status !== targetStatus;
        const shouldOverwrite = Boolean(event.overwrite || event.resolveConflict || event.forceUpdate);
        const incomingTime = timestamp ? new Date(timestamp) : new Date();

        if (isConflicting) {
          if (shouldOverwrite) {
            const updated = await prisma.attendanceRecord.update({
              where: { id: existingRecord.id },
              data: { status: targetStatus, method: 'OFFLINE_SYNC', markedAt: incomingTime, remarks: remarks || `Conflict resolved: ${existingRecord.status} -> ${targetStatus}` },
            });

            await prisma.syncOperation.update({
              where: { id: syncOp.id },
              data: {
                status: 'SYNCED',
                studentId: student.id,
                resolvedAt: new Date(),
                resolvedById: teacherId,
                processedAt: new Date(),
                conflictData: { previousStatus: existingRecord.status, newStatus: targetStatus, resolution: 'OVERWRITE_APPLIED' },
              },
            });

            conflictsResolvedCount++;
            results.push({
              operationId: opId,
              eventId: opId,
              success: true,
              isConflict: true,
              conflictResolved: true,
              recordId: updated.id,
              studentName: student.name,
              previousStatus: existingRecord.status,
              status: updated.status,
              message: `Conflict resolved: updated status from ${existingRecord.status} to ${targetStatus}.`,
            });
            continue;
          } else {
            // Preserve conflict details - DO NOT SILENTLY OVERWRITE
            conflictsCount++;
            const conflictData = {
              serverRecord: { id: existingRecord.id, status: existingRecord.status, method: existingRecord.method, markedAt: existingRecord.markedAt },
              offlineEvent: { status: targetStatus, timestamp: incomingTime, remarks },
            };

            await prisma.syncOperation.update({
              where: { id: syncOp.id },
              data: { status: 'CONFLICT', studentId: student.id, conflictData, lastError: `Conflicting: Server=${existingRecord.status}, Offline=${targetStatus}` },
            });

            duplicatesCount++;
            results.push({
              operationId: opId,
              eventId: opId,
              success: true,
              isDuplicate: true,
              hasConflict: true,
              conflictId: syncOp.id,
              recordId: existingRecord.id,
              studentName: student.name,
              currentStatus: existingRecord.status,
              message: `Retained existing status ${existingRecord.status} over conflicting offline status ${targetStatus}. Stored for review.`,
            });
            continue;
          }
        } else {
          // Identical status -> Idempotent Duplicate
          duplicatesCount++;
          await prisma.syncOperation.update({
            where: { id: syncOp.id },
            data: { status: 'SYNCED', studentId: student.id, processedAt: new Date() },
          });

          results.push({
            operationId: opId,
            eventId: opId,
            success: true,
            isDuplicate: true,
            hasConflict: false,
            recordId: existingRecord.id,
            studentName: student.name,
            currentStatus: existingRecord.status,
            message: 'Already recorded.',
          });
          continue;
        }
      }

      // 6. Create Attendance Record
      const markedTime = timestamp ? new Date(timestamp) : new Date();
      const newRecord = await prisma.attendanceRecord.create({
        data: { sessionId: targetSessionId, studentId: student.id, status: targetStatus, method: 'OFFLINE_SYNC', markedAt: markedTime, remarks: remarks || `Synced offline op: ${opId}` },
      });

      await prisma.syncOperation.update({
        where: { id: syncOp.id },
        data: { status: 'SYNCED', studentId: student.id, processedAt: new Date() },
      });

      syncedCount++;
      results.push({ operationId: opId, eventId: opId, success: true, recordId: newRecord.id, studentName: student.name, status: newRecord.status });
    } catch (err) {
      if (err.code === 'P2002') {
        duplicatesCount++;
        await prisma.syncOperation.update({ where: { id: syncOp.id }, data: { status: 'SYNCED', processedAt: new Date() } });
        results.push({ operationId: opId, eventId: opId, success: true, isDuplicate: true, message: 'Concurrent duplicate record safely handled.' });
        continue;
      }

      failedCount++;
      await prisma.syncOperation.update({ where: { id: syncOp.id }, data: { status: 'FAILED', lastError: err.message } });
      results.push({ operationId: opId, eventId: opId, success: false, error: err.message });
    }
  }

  // Audit Log
  await logAudit({
    actorId: teacherId,
    action: 'OFFLINE_BATCH_SYNC',
    entityType: 'SyncOperation',
    entityId: schoolId,
    newValue: { totalEvents: events.length, syncedCount, duplicatesCount, conflictsCount, conflictsResolvedCount, failedCount },
    reason: `Offline sync processed: ${syncedCount} synced, ${conflictsResolvedCount} resolved, ${failedCount} failed.`,
  });

  return { success: true, totalEvents: events.length, syncedCount, duplicatesCount, conflictsCount, conflictsResolvedCount, failedCount, results };
};

/**
 * Retrieve institution-wide sync engine metrics and operational counters
 */
export const getSyncStatus = async ({ schoolId, teacherId = null }) => {
  const where = { schoolId };
  if (teacherId) where.teacherId = teacherId;

  const [totalCount, syncedCount, pendingCount, failedCount, conflictCount, recentOperations, lastSyncOp] =
    await Promise.all([
      prisma.syncOperation.count({ where }),
      prisma.syncOperation.count({ where: { ...where, status: 'SYNCED' } }),
      prisma.syncOperation.count({ where: { ...where, status: { in: ['PENDING', 'SYNCING'] } } }),
      prisma.syncOperation.count({ where: { ...where, status: 'FAILED' } }),
      prisma.syncOperation.count({ where: { ...where, status: 'CONFLICT' } }),
      prisma.syncOperation.findMany({
        where,
        take: 10,
        orderBy: { updatedAt: 'desc' },
        include: {
          student: { select: { id: true, name: true, admissionNumber: true, class: { select: { name: true, section: true } } } },
          teacher: { select: { id: true, name: true, email: true } },
        },
      }),
      prisma.syncOperation.findFirst({ where: { ...where, status: 'SYNCED' }, orderBy: { processedAt: 'desc' }, select: { processedAt: true } }),
    ]);

  return {
    totalOperations: totalCount,
    syncedCount,
    pendingCount,
    failedCount,
    conflictCount,
    lastSyncTimestamp: lastSyncOp?.processedAt || null,
    recentOperations: recentOperations.map((op) => ({
      id: op.id,
      operationId: op.operationId,
      status: op.status,
      action: op.action,
      studentName: op.student?.name || null,
      admissionNumber: op.student?.admissionNumber || null,
      className: op.student?.class ? `${op.student.class.name}-${op.student.class.section}` : null,
      teacherName: op.teacher?.name,
      retryCount: op.retryCount,
      lastError: op.lastError,
      conflictData: op.conflictData,
      createdAt: op.createdAt,
      updatedAt: op.updatedAt,
    })),
  };
};

/**
 * List sync conflicts awaiting administrative review
 */
export const getSyncConflicts = async ({ schoolId, page = 1, limit = 20 }) => {
  const take = Math.max(1, parseInt(limit, 10));
  const skip = (Math.max(1, parseInt(page, 10)) - 1) * take;
  const where = { schoolId, status: 'CONFLICT' };

  const [totalCount, conflicts] = await Promise.all([
    prisma.syncOperation.count({ where }),
    prisma.syncOperation.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        student: { include: { class: { select: { name: true, section: true } } } },
        teacher: { select: { id: true, name: true, email: true } },
      },
    }),
  ]);

  return {
    conflicts: conflicts.map((c) => ({
      id: c.id,
      operationId: c.operationId,
      student: c.student ? { id: c.student.id, name: c.student.name, admissionNumber: c.student.admissionNumber, className: `${c.student.class.name}-${c.student.class.section}` } : null,
      teacher: c.teacher,
      payload: c.payload,
      conflictData: c.conflictData,
      createdAt: c.createdAt,
    })),
    pagination: { page: Math.max(1, parseInt(page, 10)), limit: take, totalCount, totalPages: Math.ceil(totalCount / take) || 1 },
  };
};

/**
 * Resolve sync conflict with predictable strategy and audit trail
 */
export const resolveSyncConflict = async ({ conflictId, schoolId, resolvedById, strategy = 'KEEP_SERVER' }) => {
  const op = await prisma.syncOperation.findFirst({ where: { id: conflictId, schoolId, status: 'CONFLICT' } });
  if (!op) {
    const err = new Error('Conflict operation not found or already resolved.');
    err.statusCode = 404;
    throw err;
  }

  const { serverRecord, offlineEvent } = op.conflictData || {};

  if (strategy === 'ACCEPT_OFFLINE') {
    if (serverRecord?.id && offlineEvent?.status) {
      await prisma.attendanceRecord.update({
        where: { id: serverRecord.id },
        data: { status: offlineEvent.status, method: 'OFFLINE_SYNC', remarks: `Conflict resolved: accepted offline ${offlineEvent.status}` },
      });
    }

    await prisma.syncOperation.update({
      where: { id: op.id },
      data: { status: 'SYNCED', resolvedAt: new Date(), resolvedById, processedAt: new Date(), lastError: null },
    });

    await logAudit({
      actorId: resolvedById,
      action: 'SYNC_CONFLICT_RESOLVED',
      entityType: 'SyncOperation',
      entityId: op.id,
      previousValue: serverRecord,
      newValue: { status: offlineEvent?.status, strategy: 'ACCEPT_OFFLINE' },
      reason: 'Administrator accepted offline attendance status.',
    });

    return { success: true, message: `Conflict resolved: Accepted offline status ${offlineEvent?.status}.`, strategy };
  }

  await prisma.syncOperation.update({
    where: { id: op.id },
    data: { status: 'SYNCED', resolvedAt: new Date(), resolvedById, processedAt: new Date(), lastError: null },
  });

  await logAudit({
    actorId: resolvedById,
    action: 'SYNC_CONFLICT_RESOLVED',
    entityType: 'SyncOperation',
    entityId: op.id,
    previousValue: offlineEvent,
    newValue: { status: serverRecord?.status, strategy: 'KEEP_SERVER' },
    reason: 'Administrator retained server record status.',
  });

  return { success: true, message: `Conflict resolved: Retained server status ${serverRecord?.status}.`, strategy };
};

/**
 * Retry failed sync operations
 */
export const retryFailedOperations = async ({ schoolId, teacherId = null }) => {
  const where = { schoolId, status: 'FAILED', retryCount: { lt: MAX_AUTO_RETRIES } };
  if (teacherId) where.teacherId = teacherId;

  const failedOps = await prisma.syncOperation.findMany({ where, take: 50 });
  if (failedOps.length === 0) {
    return { success: true, retriedCount: 0, message: 'No failed operations eligible for retry.' };
  }

  const events = failedOps.map((op) => ({ ...op.payload, operationId: op.operationId, retryCount: op.retryCount + 1 }));
  const result = await syncBatch({ schoolId, teacherId: teacherId || failedOps[0].teacherId, events });

  return { success: true, retriedCount: failedOps.length, batchResult: result };
};
