import prisma from '../config/db.js';
import { logAudit } from './auditService.js';

/**
 * Download complete offline class roster for teacher's assigned class
 */
export const downloadRoster = async ({ classId, schoolId, teacherId }) => {
  const cls = await prisma.class.findFirst({
    where: { id: classId, schoolId },
    include: {
      students: {
        where: { active: true },
        select: {
          id: true,
          name: true,
          admissionNumber: true,
          rollNumber: true,
          qrToken: true,
          gender: true,
        },
        orderBy: [{ rollNumber: 'asc' }, { name: 'asc' }],
      },
    },
  });

  if (!cls) {
    throw new Error('Class not found.');
  }

  // Check today's session
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endOfDay = new Date(today);
  endOfDay.setHours(23, 59, 59, 999);

  let session = await prisma.attendanceSession.findFirst({
    where: {
      classId,
      sessionDate: { gte: today, lte: endOfDay },
    },
  });

  if (!session) {
    session = await prisma.attendanceSession.create({
      data: {
        classId,
        teacherId,
        sessionDate: new Date(),
        status: 'OPEN',
        notes: `Offline-enabled session for ${cls.name}-${cls.section}`,
      },
    });
  }

  return {
    class: {
      id: cls.id,
      name: cls.name,
      section: cls.section,
      academicYear: cls.academicYear,
    },
    sessionId: session.id,
    sessionDate: session.sessionDate,
    downloadedAt: new Date().toISOString(),
    students: cls.students,
  };
};

/**
 * Synchronize batch attendance events recorded offline
 * Ensures idempotent processing so re-syncing doesn't create duplicate records or errors.
 */
export const syncBatch = async ({ schoolId, teacherId, events = [] }) => {
  if (!Array.isArray(events) || events.length === 0) {
    return {
      success: true,
      syncedCount: 0,
      message: 'No events to sync.',
      results: [],
    };
  }

  const results = [];
  let syncedCount = 0;
  let duplicatesCount = 0;
  let conflictsResolvedCount = 0;
  let failedCount = 0;

  const VALID_STATUSES = ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'];

  for (const event of events) {
    const { eventId, sessionId, classId, studentId, qrToken, status = 'PRESENT', timestamp, remarks } = event;

    try {
      // 1. Resolve student
      let student = null;
      if (studentId) {
        student = await prisma.student.findFirst({
          where: { id: studentId, schoolId, active: true },
        });
      } else if (qrToken) {
        student = await prisma.student.findFirst({
          where: { qrToken, schoolId, active: true },
        });
      }

      if (!student) {
        failedCount++;
        results.push({
          eventId,
          success: false,
          error: 'Student not found in this school.',
        });
        continue;
      }

      // 2. Resolve or find session
      let targetSessionId = sessionId;
      if (!targetSessionId) {
        const eventDate = timestamp ? new Date(timestamp) : new Date();
        const start = new Date(eventDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(eventDate);
        end.setHours(23, 59, 59, 999);

        let session = await prisma.attendanceSession.findFirst({
          where: {
            classId: student.classId,
            sessionDate: { gte: start, lte: end },
          },
        });

        if (!session) {
          session = await prisma.attendanceSession.create({
            data: {
              classId: student.classId,
              teacherId,
              sessionDate: eventDate,
              status: 'OPEN',
              notes: 'Auto-created during offline synchronization',
            },
          });
        }
        targetSessionId = session.id;
      }

      // 3. Upsert attendance record idempotently with conflict handling
      const targetStatus = status ? status.toUpperCase() : 'PRESENT';
      if (!VALID_STATUSES.includes(targetStatus)) {
        failedCount++;
        results.push({
          eventId,
          success: false,
          error: `Invalid attendance status: "${status}". Supported values are: ${VALID_STATUSES.join(', ')}.`,
        });
        continue;
      }

      const existing = await prisma.attendanceRecord.findUnique({
        where: {
          sessionId_studentId: {
            sessionId: targetSessionId,
            studentId: student.id,
          },
        },
      });

      if (existing) {
        const isConflicting = existing.status !== targetStatus;
        const shouldOverwrite = Boolean(event.overwrite || event.resolveConflict || event.forceUpdate);
        const incomingTime = timestamp ? new Date(timestamp) : new Date();
        const existingTime = existing.markedAt ? new Date(existing.markedAt) : new Date(0);
        const isNewer = Boolean(timestamp && incomingTime.getTime() > existingTime.getTime());

        // Conflict handling: if status differs and (overwrite requested OR incoming event has a newer timestamp)
        if (isConflicting && (shouldOverwrite || isNewer)) {
          const updatedRecord = await prisma.attendanceRecord.update({
            where: { id: existing.id },
            data: {
              status: targetStatus,
              method: 'OFFLINE_SYNC',
              markedAt: incomingTime,
              remarks: remarks || `Conflict resolved: updated from ${existing.status} to ${targetStatus}`,
            },
          });

          conflictsResolvedCount++;
          results.push({
            eventId,
            success: true,
            isConflict: true,
            conflictResolved: true,
            recordId: updatedRecord.id,
            studentName: student.name,
            previousStatus: existing.status,
            status: updatedRecord.status,
            message: `Conflict resolved: updated status from ${existing.status} to ${targetStatus}.`,
          });
          continue;
        }

        // Otherwise retain existing and flag duplicate/conflict
        duplicatesCount++;
        results.push({
          eventId,
          success: true,
          isDuplicate: true,
          hasConflict: isConflicting,
          recordId: existing.id,
          studentName: student.name,
          currentStatus: existing.status,
          message: isConflicting
            ? `Retained existing status ${existing.status} over conflicting offline status ${targetStatus}.`
            : 'Already recorded.',
        });
        continue;
      }

      const markedTime = timestamp ? new Date(timestamp) : new Date();

      const newRecord = await prisma.attendanceRecord.create({
        data: {
          sessionId: targetSessionId,
          studentId: student.id,
          status: targetStatus,
          method: 'OFFLINE_SYNC',
          markedAt: markedTime,
          remarks: remarks || `Synced offline event: ${eventId || 'auto'}`,
        },
      });

      syncedCount++;
      results.push({
        eventId,
        success: true,
        recordId: newRecord.id,
        studentName: student.name,
        status: newRecord.status,
      });
    } catch (err) {
      if (err.code === 'P2002') {
        duplicatesCount++;
        results.push({
          eventId,
          success: true,
          isDuplicate: true,
          message: 'Concurrent duplicate record detected and ignored.',
        });
        continue;
      }
      failedCount++;
      results.push({
        eventId,
        success: false,
        error: err.message,
      });
    }
  }

  await logAudit({
    actorId: teacherId,
    action: 'OFFLINE_SYNC_COMPLETED',
    entityType: 'AttendanceSync',
    entityId: teacherId,
    newValue: { syncedCount, duplicatesCount, conflictsResolvedCount, failedCount, totalEvents: events.length },
    reason: 'Offline attendance queue synchronized to central database.',
  });

  return {
    success: true,
    totalReceived: events.length,
    syncedCount,
    duplicatesCount,
    conflictsResolvedCount,
    failedCount,
    results,
  };
};

