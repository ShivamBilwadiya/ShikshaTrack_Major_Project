import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/config/db.js';

describe('Offline Attendance Sync Reliability & Recovery Subsystem', () => {
  let adminToken;
  let teacherToken;
  let classId;
  let student;
  let conflictOperationId;

  beforeAll(async () => {
    // 1. Admin login
    const adminRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@shikshatrack.in', password: 'admin123' });
    expect(adminRes.status).toBe(200);
    adminToken = adminRes.body.data.token;

    // 2. Teacher login
    const teacherRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'ramesh.teacher@shikshatrack.in', password: 'teacher123' });
    expect(teacherRes.status).toBe(200);
    teacherToken = teacherRes.body.data.token;

    // 3. Resolve active class and student
    const classRes = await request(app)
      .get('/api/v1/classes')
      .set('Authorization', `Bearer ${adminToken}`);
    const classList = classRes.body.data?.classes || classRes.body.data;
    classId = classList[0].id;

    const studentRes = await request(app)
      .get('/api/v1/students')
      .set('Authorization', `Bearer ${adminToken}`);
    student = studentRes.body.data.students[0];

    // Clean up test sync operations and today's attendance for this student
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const sessions = await prisma.attendanceSession.findMany({
      where: { classId: student.classId, sessionDate: { gte: todayStart } },
    });
    if (sessions.length > 0) {
      await prisma.attendanceRecord.deleteMany({
        where: { studentId: student.id, sessionId: { in: sessions.map((s) => s.id) } },
      });
    }
    await prisma.syncOperation.deleteMany({});
  });

  afterAll(async () => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    if (student) {
      const sessions = await prisma.attendanceSession.findMany({
        where: { classId: student.classId, sessionDate: { gte: todayStart } },
      });
      if (sessions.length > 0) {
        await prisma.attendanceRecord.deleteMany({
          where: { studentId: student.id, sessionId: { in: sessions.map((s) => s.id) } },
        });
      }
    }
    await prisma.syncOperation.deleteMany({});
  });

  describe('1. Security & RBAC Access Control', () => {
    it('GET /api/v1/sync/status - should reject unauthenticated request with 401', async () => {
      const res = await request(app).get('/api/v1/sync/status');
      expect(res.status).toBe(401);
    });

    it('GET /api/v1/sync/conflicts - should reject unauthenticated request with 401', async () => {
      const res = await request(app).get('/api/v1/sync/conflicts');
      expect(res.status).toBe(401);
    });
  });

  describe('2. Offline Class Roster Download', () => {
    it('GET /api/v1/sync/roster/:classId - should download class roster with student QR tokens', async () => {
      const res = await request(app)
        .get(`/api/v1/sync/roster/${classId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.students)).toBe(true);
      expect(res.body.data.students[0].qrToken).toBeDefined();
      expect(res.body.data.sessionId).toBeDefined();
    });
  });

  describe('3. Batch Synchronization & Idempotency Protection', () => {
    it('POST /api/v1/sync/batch - should handle offline batch events idempotently', async () => {
      const eventId = `test-offline-${Date.now()}`;
      const testEvents = [
        {
          operationId: eventId,
          eventId,
          classId: student.classId,
          studentId: student.id,
          status: 'PRESENT',
          timestamp: new Date().toISOString(),
        },
      ];

      // First Sync
      const res1 = await request(app)
        .post('/api/v1/sync/batch')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ events: testEvents });

      expect(res1.status).toBe(200);
      expect(res1.body.success).toBe(true);

      // Second Sync with identical event (re-transmission / idempotent test)
      const res2 = await request(app)
        .post('/api/v1/sync/batch')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ events: testEvents });

      expect(res2.status).toBe(200);
      expect(res2.body.success).toBe(true);
      expect(res2.body.data.duplicatesCount).toBeGreaterThanOrEqual(1);
    });

    it('POST /api/v1/sync/batch - should detect conflict and preserve server data without silent overwrite', async () => {
      const conflictEvent = [
        {
          operationId: `conflict-detect-${Date.now()}`,
          classId: student.classId,
          studentId: student.id,
          status: 'ABSENT', // Conflicting with previously marked PRESENT
          timestamp: new Date().toISOString(),
        },
      ];

      const res = await request(app)
        .post('/api/v1/sync/batch')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ events: conflictEvent });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.conflictsCount).toBe(1);
      expect(res.body.data.results[0].hasConflict).toBe(true);
      expect(res.body.data.results[0].conflictId).toBeDefined();

      conflictOperationId = res.body.data.results[0].conflictId;
    });

    it('POST /api/v1/sync/batch - should resolve conflict and update status when resolveConflict is requested', async () => {
      const updateEvent = [
        {
          operationId: `conflict-resolve-${Date.now()}`,
          classId: student.classId,
          studentId: student.id,
          status: 'LATE',
          resolveConflict: true,
          timestamp: new Date().toISOString(),
        },
      ];

      const res = await request(app)
        .post('/api/v1/sync/batch')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ events: updateEvent });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.conflictsResolvedCount).toBe(1);
      expect(res.body.data.results[0].conflictResolved).toBe(true);
      expect(res.body.data.results[0].status).toBe('LATE');
    });

    it('POST /api/v1/sync/batch - should reject invalid attendance status within batch event gracefully', async () => {
      const invalidEvent = [
        {
          operationId: `invalid-status-${Date.now()}`,
          classId: student.classId,
          studentId: student.id,
          status: 'NON_EXISTENT_STATUS',
        },
      ];

      const res = await request(app)
        .post('/api/v1/sync/batch')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ events: invalidEvent });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.failedCount).toBe(1);
      expect(res.body.data.results[0].error).toContain('Invalid attendance status');
    });

    it('POST /api/v1/sync/batch - should reject malformed sync payload without events array', async () => {
      const res = await request(app)
        .post('/api/v1/sync/batch')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ invalidField: true });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('4. Sync Health, Conflict Inspection & Arbitration', () => {
    it('GET /api/v1/sync/status - should return sync engine metrics and operational counts', async () => {
      const res = await request(app)
        .get('/api/v1/sync/status')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.totalOperations).toBeGreaterThan(0);
      expect(res.body.data.conflictCount).toBeGreaterThanOrEqual(1);
      expect(Array.isArray(res.body.data.recentOperations)).toBe(true);
    });

    it('GET /api/v1/sync/conflicts - should list detected conflicts with server vs offline payloads', async () => {
      const res = await request(app)
        .get('/api/v1/sync/conflicts')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.conflicts.length).toBeGreaterThanOrEqual(1);
      const target = res.body.data.conflicts.find((c) => c.id === conflictOperationId);
      expect(target).toBeDefined();
      expect(target.conflictData.serverRecord).toBeDefined();
      expect(target.conflictData.offlineEvent).toBeDefined();
    });

    it('POST /api/v1/sync/conflicts/:id/resolve - should resolve conflict with KEEP_SERVER strategy', async () => {
      const res = await request(app)
        .post(`/api/v1/sync/conflicts/${conflictOperationId}/resolve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ strategy: 'KEEP_SERVER' });

      expect(res.status).toBe(200);
      expect(res.body.data.success).toBe(true);
      expect(res.body.data.strategy).toBe('KEEP_SERVER');
    });

    it('POST /api/v1/sync/retry-failed - should trigger retry for failed sync operations', async () => {
      const res = await request(app)
        .post('/api/v1/sync/retry-failed')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.success).toBe(true);
    });
  });
});
