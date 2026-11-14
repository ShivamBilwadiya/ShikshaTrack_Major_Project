import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';

describe('Attendance Session & QR Scanning API', () => {
  let adminToken;
  let teacherToken;
  let class8AId;
  let student8A;
  let student9A;
  let activeSessionId;

  beforeAll(async () => {
    // 1. Admin login
    const adminRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@shikshatrack.in', password: 'admin123' });
    adminToken = adminRes.body.data.token;

    // 2. Teacher login (Ramesh Sharma - assigned to Class 8-A)
    const teacherRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'ramesh.teacher@shikshatrack.in', password: 'teacher123' });
    teacherToken = teacherRes.body.data.token;

    // 3. Get Class 8-A
    const classRes = await request(app)
      .get('/api/v1/classes')
      .set('Authorization', `Bearer ${adminToken}`);
    const cls8A = classRes.body.data.find((c) => c.name === 'Class 8' && c.section === 'A');
    class8AId = cls8A.id;

    // 4. Get students from Class 8-A and Class 9-A
    const studentRes = await request(app)
      .get('/api/v1/students?limit=100')
      .set('Authorization', `Bearer ${adminToken}`);
    student8A = studentRes.body.data.students.find((s) => s.class.name === 'Class 8' && s.class.section === 'A');
    student9A = studentRes.body.data.students.find((s) => s.class.name === 'Class 9');
  });

  it('POST /api/v1/attendance/sessions/start - should start attendance session', async () => {
    const res = await request(app)
      .post('/api/v1/attendance/sessions/start')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ classId: class8AId });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeDefined();
    activeSessionId = res.body.data.id;
  });

  it('POST /api/v1/attendance/scan - should reject wrong class student scan', async () => {
    const res = await request(app)
      .post('/api/v1/attendance/scan')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        sessionId: activeSessionId,
        qrToken: student9A.qrToken,
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('Wrong Class');
  });

  it('POST /api/v1/attendance/scan - should reject invalid QR token', async () => {
    const res = await request(app)
      .post('/api/v1/attendance/scan')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        sessionId: activeSessionId,
        qrToken: 'ST-INVALID-TOKEN-9999',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('Invalid QR Code');
  });

  it('POST /api/v1/attendance/manual - should mark manual attendance', async () => {
    const res = await request(app)
      .post('/api/v1/attendance/manual')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        sessionId: activeSessionId,
        studentId: student8A.id,
        status: 'PRESENT',
        remarks: 'Manual roll call test',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('PRESENT');
  });

  it('POST /api/v1/attendance/scan - should prevent duplicate scans for already marked student', async () => {
    const res = await request(app)
      .post('/api/v1/attendance/scan')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        sessionId: activeSessionId,
        qrToken: student8A.qrToken,
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('Duplicate Scan');
  });

  it('POST /api/v1/attendance/scan - should handle concurrent scan requests with ACID transaction consistency', async () => {
    // Pick an unmarked student from 8A if available
    const listRes = await request(app)
      .get('/api/v1/students?limit=20')
      .set('Authorization', `Bearer ${adminToken}`);
    const candidate = listRes.body.data.students.find(
      (s) => s.classId === class8AId && s.id !== student8A.id
    );

    if (candidate) {
      // Fire two identical scan requests simultaneously
      const [resA, resB] = await Promise.all([
        request(app)
          .post('/api/v1/attendance/scan')
          .set('Authorization', `Bearer ${teacherToken}`)
          .send({ sessionId: activeSessionId, qrToken: candidate.qrToken }),
        request(app)
          .post('/api/v1/attendance/scan')
          .set('Authorization', `Bearer ${teacherToken}`)
          .send({ sessionId: activeSessionId, qrToken: candidate.qrToken }),
      ]);

      // Exactly one must succeed (200) and the other must be rejected (400)
      const statuses = [resA.status, resB.status];
      expect(statuses).toContain(200);
      expect(statuses).toContain(400);
    }
  });

  it('POST /api/v1/attendance/sessions/start - should reject unauthorized class access', async () => {
    const res = await request(app)
      .post('/api/v1/attendance/sessions/start')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ classId: 'non-existent-class-id-9999' });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });
});

