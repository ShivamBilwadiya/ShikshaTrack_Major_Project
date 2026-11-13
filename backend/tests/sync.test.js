import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';

describe('Offline Roster & Idempotent Synchronization API', () => {
  let adminToken;
  let teacherToken;
  let classId;
  let student;

  beforeAll(async () => {
    const adminRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@shikshatrack.in', password: 'admin123' });
    adminToken = adminRes.body.data.token;

    const teacherRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'ramesh.teacher@shikshatrack.in', password: 'teacher123' });
    teacherToken = teacherRes.body.data.token;

    const classRes = await request(app)
      .get('/api/v1/classes')
      .set('Authorization', `Bearer ${adminToken}`);
    classId = classRes.body.data[0].id;

    const studentRes = await request(app)
      .get('/api/v1/students')
      .set('Authorization', `Bearer ${adminToken}`);
    student = studentRes.body.data.students[0];
  });

  it('GET /api/v1/sync/roster/:classId - should download class roster with student QR tokens', async () => {
    const res = await request(app)
      .get(`/api/v1/sync/roster/${classId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.students)).toBe(true);
    expect(res.body.data.students[0].qrToken).toBeDefined();
  });

  it('POST /api/v1/sync/batch - should handle offline batch events idempotently', async () => {
    const eventId = `test-offline-${Date.now()}`;
    const testEvents = [
      {
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

  it('POST /api/v1/sync/batch - should reject malformed sync payload without events array', async () => {
    const res = await request(app)
      .post('/api/v1/sync/batch')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ invalidField: true });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});
