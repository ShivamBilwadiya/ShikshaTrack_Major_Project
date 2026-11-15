import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/config/db.js';

describe('System Administration & Audit Dashboard API', () => {
  let adminToken;
  let adminUser;
  let teacherToken;
  let testTeacherUser;

  beforeAll(async () => {
    // 1. Admin login
    const adminRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@shikshatrack.in', password: 'admin123' });
    expect(adminRes.status).toBe(200);
    adminToken = adminRes.body.data.token;
    adminUser = adminRes.body.data.user;

    // 2. Teacher login
    const teacherRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'ramesh.teacher@shikshatrack.in', password: 'teacher123' });
    expect(teacherRes.status).toBe(200);
    teacherToken = teacherRes.body.data.token;

    // 3. Create a temporary teacher account for activation/deactivation testing
    testTeacherUser = await prisma.user.create({
      data: {
        name: 'Audit Test Teacher',
        email: `audit.test.${Date.now()}@shikshatrack.in`,
        passwordHash: '$2b$10$abcdefghijklmnopqrstuvwxyz1234567890',
        role: 'TEACHER',
        schoolId: adminUser.schoolId,
        active: true,
      },
    });
  });

  afterAll(async () => {
    if (testTeacherUser) {
      await prisma.auditLog.deleteMany({
        where: { entityId: testTeacherUser.id },
      });
      await prisma.user.deleteMany({
        where: { id: testTeacherUser.id },
      });
    }
  });

  describe('RBAC & Route Protection', () => {
    it('should reject unauthenticated request with 401', async () => {
      const res = await request(app).get('/api/v1/admin/users');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should reject non-admin (TEACHER) access with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${teacherToken}`);
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });

  describe('User Listing & Security Sanitization', () => {
    it('should list institutional users without exposing password hashes or tokens', async () => {
      const res = await request(app)
        .get('/api/v1/admin/users?limit=10')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.users)).toBe(true);
      expect(res.body.data.users.length).toBeGreaterThanOrEqual(1);

      // Verify strict security sanitization: no passwordHash or token fields
      for (const u of res.body.data.users) {
        expect(u.passwordHash).toBeUndefined();
        expect(u.token).toBeUndefined();
        expect(u).toHaveProperty('id');
        expect(u).toHaveProperty('email');
        expect(u).toHaveProperty('role');
        expect(u).toHaveProperty('active');
      }
    });
  });

  describe('Account Activation / Deactivation & Audit Trail', () => {
    it('should prevent self-deactivation of current administrator', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/users/${adminUser.id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ active: false });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Self-deactivation is prohibited');
    });

    it('should deactivate a user and generate a traceable AuditLog entry', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/users/${testTeacherUser.id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          active: false,
          reason: 'Temporary suspension for compliance review',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.active).toBe(false);

      // Verify AuditLog entry was recorded
      const log = await prisma.auditLog.findFirst({
        where: {
          entityId: testTeacherUser.id,
          action: 'USER_DEACTIVATED',
        },
      });
      expect(log).toBeDefined();
      expect(log.actorId).toBe(adminUser.id);
      expect(log.reason).toContain('Temporary suspension');
    });
  });

  describe('Centralized Audit Logs & System Health', () => {
    it('should retrieve audit logs with actor details and activity summary', async () => {
      const logsRes = await request(app)
        .get('/api/v1/admin/audit-logs?action=USER_DEACTIVATED')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(logsRes.status).toBe(200);
      expect(logsRes.body.success).toBe(true);
      expect(Array.isArray(logsRes.body.data.logs)).toBe(true);
      expect(logsRes.body.data.logs.length).toBeGreaterThanOrEqual(1);
      expect(logsRes.body.data.logs[0].actor).toBeDefined();

      const summaryRes = await request(app)
        .get('/api/v1/admin/activity-summary')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(summaryRes.status).toBe(200);
      expect(summaryRes.body.success).toBe(true);
      expect(summaryRes.body.data).toHaveProperty('totalUsers');
      expect(summaryRes.body.data).toHaveProperty('activeUsers');
    });

    it('should return system health diagnostics and database connectivity', async () => {
      const res = await request(app)
        .get('/api/v1/admin/health')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('HEALTHY');
      expect(res.body.data.database.status).toBe('CONNECTED');
      expect(typeof res.body.data.database.latencyMs).toBe('number');
      expect(typeof res.body.data.uptimeSeconds).toBe('number');
    });
  });
});
