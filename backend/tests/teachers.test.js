import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';

describe('Comprehensive Teacher & Class Assignment Management API', () => {
  let adminToken;
  let teacherToken;
  let class8AId;
  let class8BId;
  let class9AId;
  let createdTeacherId;
  let teacherWithSessionId;

  beforeAll(async () => {
    // 1. Admin login
    const adminRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@shikshatrack.in', password: 'admin123' });
    expect(adminRes.status).toBe(200);
    adminToken = adminRes.body.data.token;

    // 2. Existing Teacher login (Ramesh Sharma)
    const teacherRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'ramesh.teacher@shikshatrack.in', password: 'teacher123' });
    expect(teacherRes.status).toBe(200);
    teacherToken = teacherRes.body.data.token;
    teacherWithSessionId = teacherRes.body.data.user.id;

    // 3. Retrieve classes
    const classRes = await request(app)
      .get('/api/v1/classes')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(classRes.status).toBe(200);

    const classes = classRes.body.data;
    const cls8A = classes.find((c) => c.name === 'Class 8' && c.section === 'A');
    const cls8B = classes.find((c) => c.name === 'Class 8' && c.section === 'B');
    const cls9A = classes.find((c) => c.name === 'Class 9' && c.section === 'A');

    class8AId = cls8A.id;
    class8BId = cls8B ? cls8B.id : classes[1].id;
    class9AId = cls9A ? cls9A.id : classes[classes.length - 1].id;

    // Ensure teacherWithSessionId is assigned to class8AId
    await request(app)
      .put(`/api/v1/teachers/${teacherWithSessionId}/assignments`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ classIds: [class8AId] });
  });

  describe('RBAC & Authorization Guard', () => {
    it('GET /api/v1/teachers - should reject unauthorized requests without token', async () => {
      const res = await request(app).get('/api/v1/teachers');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('GET /api/v1/teachers - should reject non-admin (TEACHER role) access with 403', async () => {
      const res = await request(app)
        .get('/api/v1/teachers')
        .set('Authorization', `Bearer ${teacherToken}`);
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/teachers - Search, Filtering & Pagination', () => {
    it('should list all teachers as array when no pagination params are sent', async () => {
      const res = await request(app)
        .get('/api/v1/teachers')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);

      const ramesh = res.body.data.find((t) => t.email === 'ramesh.teacher@shikshatrack.in');
      expect(ramesh).toBeDefined();
      expect(ramesh.teacherAssignments).toBeDefined();
    });

    it('should return paginated teachers and metadata when page and limit are provided', async () => {
      const res = await request(app)
        .get('/api/v1/teachers?page=1&limit=2')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.teachers).toBeDefined();
      expect(Array.isArray(res.body.data.teachers)).toBe(true);
      expect(res.body.data.teachers.length).toBeLessThanOrEqual(2);
      expect(res.body.data.pagination).toBeDefined();
      expect(res.body.data.pagination.page).toBe(1);
      expect(res.body.data.pagination.limit).toBe(2);
      expect(res.body.data.pagination.total).toBeGreaterThanOrEqual(1);
    });

    it('should search teachers by name or email query', async () => {
      const res = await request(app)
        .get('/api/v1/teachers?search=Ramesh')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const list = Array.isArray(res.body.data) ? res.body.data : res.body.data.teachers;
      expect(list.length).toBeGreaterThanOrEqual(1);
      expect(list.some((t) => t.name.includes('Ramesh'))).toBe(true);
    });

    it('should filter teachers by active status', async () => {
      const res = await request(app)
        .get('/api/v1/teachers?status=active')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const list = Array.isArray(res.body.data) ? res.body.data : res.body.data.teachers;
      expect(list.every((t) => t.active === true)).toBe(true);
    });

    it('should filter teachers by assigned classId', async () => {
      const res = await request(app)
        .get(`/api/v1/teachers?classId=${class8AId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const list = Array.isArray(res.body.data) ? res.body.data : res.body.data.teachers;
      expect(list.length).toBeGreaterThanOrEqual(1);
      expect(
        list.every((t) => t.teacherAssignments.some((ta) => ta.classId === class8AId))
      ).toBe(true);
    });
  });

  describe('POST /api/v1/teachers - Create Teacher & Validation', () => {
    it('should reject creation with missing or empty name', async () => {
      const res = await request(app)
        .post('/api/v1/teachers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: '',
          email: 'valid.email@shikshatrack.in',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Teacher name');
    });

    it('should reject creation with invalid email format', async () => {
      const res = await request(app)
        .post('/api/v1/teachers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Pooja Verma',
          email: 'not-an-email-at-all',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Invalid email format');
    });

    it('should reject creation with password shorter than 6 characters', async () => {
      const res = await request(app)
        .post('/api/v1/teachers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Pooja Verma',
          email: 'pooja.verma@shikshatrack.in',
          password: '123',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('at least 6 characters');
    });

    it('should reject creation when email is already registered (409 Conflict)', async () => {
      const res = await request(app)
        .post('/api/v1/teachers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Duplicate Ramesh',
          email: 'ramesh.teacher@shikshatrack.in',
          password: 'password123',
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('already exists');
    });

    it('should reject assigned classes that do not exist or belong to another school', async () => {
      const fakeClassId = '00000000-0000-0000-0000-000000000000';
      const res = await request(app)
        .post('/api/v1/teachers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Foreign Class Teacher',
          email: `test.foreign.${Date.now()}@shikshatrack.in`,
          assignedClassIds: [fakeClassId],
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('do not exist in this school');
    });

    it('should successfully create a new teacher with trimmed name and normalized email', async () => {
      const uniqueEmail = `vikram.aditya.${Date.now()}@shikshatrack.in`;
      const res = await request(app)
        .post('/api/v1/teachers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: '   Vikram Aditya   ',
          email: `  ${uniqueEmail.toUpperCase()}  `,
          password: 'securePassword123',
          assignedClassIds: [class8BId],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.name).toBe('Vikram Aditya');
      expect(res.body.data.email).toBe(uniqueEmail.toLowerCase());
      expect(res.body.data.active).toBe(true);
      expect(res.body.data.teacherAssignments.length).toBe(1);
      expect(res.body.data.teacherAssignments[0].classId).toBe(class8BId);

      createdTeacherId = res.body.data.id;
    });
  });

  describe('GET /api/v1/teachers/:id - Teacher Details & Workload', () => {
    it('should retrieve teacher details by ID with assigned classes', async () => {
      const res = await request(app)
        .get(`/api/v1/teachers/${createdTeacherId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(createdTeacherId);
      expect(res.body.data.name).toBe('Vikram Aditya');
      expect(res.body.data._count.attendanceSessions).toBeDefined();
    });

    it('should return 404 for non-existent teacher ID', async () => {
      const nonExistentId = '11111111-1111-1111-1111-111111111111';
      const res = await request(app)
        .get(`/api/v1/teachers/${nonExistentId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Teacher not found');
    });

    it('GET /api/v1/teachers/:id/classes - should retrieve teacher classes and session workload', async () => {
      const res = await request(app)
        .get(`/api/v1/teachers/${createdTeacherId}/classes`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.teacherId).toBe(createdTeacherId);
      expect(res.body.data.totalAssignedClasses).toBe(1);
      expect(res.body.data.classes[0].classId).toBe(class8BId);
      expect(res.body.data.classes[0].totalStudents).toBeGreaterThanOrEqual(0);
    });
  });

  describe('PUT /api/v1/teachers/:id - Update Teacher Profile', () => {
    it('should update teacher name and active status', async () => {
      const res = await request(app)
        .put(`/api/v1/teachers/${createdTeacherId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Dr. Vikram Aditya',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Dr. Vikram Aditya');
    });

    it('should reject email update if email is already taken by another account', async () => {
      const res = await request(app)
        .put(`/api/v1/teachers/${createdTeacherId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: 'ramesh.teacher@shikshatrack.in',
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('already in use');
    });
  });

  describe('Teacher-to-Class Assignment Management', () => {
    it('POST /api/v1/teachers/:id/assignments - should add a new class assignment', async () => {
      const res = await request(app)
        .post(`/api/v1/teachers/${createdTeacherId}/assignments`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          classId: class9AId,
          isClassTeacher: false,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(
        res.body.data.teacherAssignments.some((ta) => ta.classId === class9AId)
      ).toBe(true);
    });

    it('POST /api/v1/teachers/:id/assignments - should reject duplicate assignment for same class', async () => {
      const res = await request(app)
        .post(`/api/v1/teachers/${createdTeacherId}/assignments`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          classId: class9AId,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('already assigned');
    });

    it('DELETE /api/v1/teachers/:id/assignments/:classId - should unassign a class from teacher', async () => {
      const res = await request(app)
        .delete(`/api/v1/teachers/${createdTeacherId}/assignments/${class9AId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(
        res.body.data.teacherAssignments.some((ta) => ta.classId === class9AId)
      ).toBe(false);
    });

    it('DELETE /api/v1/teachers/:id/assignments/:classId - should return 404 when unassigning non-assigned class', async () => {
      const res = await request(app)
        .delete(`/api/v1/teachers/${createdTeacherId}/assignments/${class9AId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('not currently assigned');
    });

    it('PUT /api/v1/teachers/:id/assignments - should bulk replace class assignments with validation', async () => {
      const res = await request(app)
        .put(`/api/v1/teachers/${createdTeacherId}/assignments`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          assignments: [
            { classId: class8BId, isClassTeacher: false },
            { classId: class9AId, isClassTeacher: false },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.teacherAssignments.length).toBe(2);
    });

    it('PUT /api/v1/teachers/:id/assignments - should deduplicate duplicate class IDs in request', async () => {
      const res = await request(app)
        .put(`/api/v1/teachers/${createdTeacherId}/assignments`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          classIds: [class8BId, class8BId, class8BId],
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.teacherAssignments.length).toBe(1);
      expect(res.body.data.teacherAssignments[0].classId).toBe(class8BId);
    });
  });

  describe('Status Toggling & Safe Deactivation/Deletion', () => {
    it('PATCH /api/v1/teachers/:id/toggle-status - should toggle teacher active state', async () => {
      const res = await request(app)
        .patch(`/api/v1/teachers/${createdTeacherId}/toggle-status`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.active).toBe(false);

      // Toggle back to active
      const res2 = await request(app)
        .patch(`/api/v1/teachers/${createdTeacherId}/toggle-status`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res2.status).toBe(200);
      expect(res2.body.data.active).toBe(true);
    });

    it('DELETE /api/v1/teachers/:id - should safely deactivate teacher with historical attendance sessions', async () => {
      const res = await request(app)
        .delete(`/api/v1/teachers/${teacherWithSessionId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.deactivated).toBe(true);
      expect(res.body.data.message).toContain('safely deactivated');

      // Re-activate Ramesh and restore class assignment so subsequent tests remain pristine
      await request(app)
        .patch(`/api/v1/teachers/${teacherWithSessionId}/toggle-status`)
        .set('Authorization', `Bearer ${adminToken}`);

      await request(app)
        .put(`/api/v1/teachers/${teacherWithSessionId}/assignments`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ classIds: [class8AId] });
    });

    it('DELETE /api/v1/teachers/:id - should permanently delete teacher with zero historical sessions', async () => {
      const res = await request(app)
        .delete(`/api/v1/teachers/${createdTeacherId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.deleted).toBe(true);

      // Verify teacher no longer exists
      const verifyRes = await request(app)
        .get(`/api/v1/teachers/${createdTeacherId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(verifyRes.status).toBe(404);
    });
  });
});
