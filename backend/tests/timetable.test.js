import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/config/db.js';

describe('School Timetable & Class Scheduling Management API', () => {
  let adminToken;
  let teacherToken;
  let teacherId;
  let teacher2Id;
  let class1Id;
  let class2Id;
  let createdEntryId;

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
    teacherId = teacherRes.body.data.user.id;

    // Retrieve active classes and teachers from DB for testing
    const classes = await prisma.class.findMany({ take: 2 });
    class1Id = classes[0].id;
    class2Id = classes[1].id;

    const teachers = await prisma.user.findMany({
      where: { role: 'TEACHER', id: { not: teacherId } },
      take: 1,
    });
    teacher2Id = teachers[0].id;

    // Clean up any lingering test timetable entries
    await prisma.timetableEntry.deleteMany({});
  });

  afterAll(async () => {
    await prisma.timetableEntry.deleteMany({});
  });

  describe('Authentication & Access Control', () => {
    it('should reject unauthenticated requests to timetable API with 401', async () => {
      const res = await request(app).get('/api/v1/timetable');
      expect(res.status).toBe(401);
    });

    it('should reject non-admin (TEACHER) entry creation with 403', async () => {
      const res = await request(app)
        .post('/api/v1/timetable')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          classId: class1Id,
          teacherId,
          subject: 'Mathematics',
          dayOfWeek: 'MONDAY',
          startTime: '09:00',
          endTime: '10:00',
        });
      expect(res.status).toBe(403);
    });

    it('should allow TEACHER to retrieve personal weekly schedule via /my-schedule', async () => {
      const res = await request(app)
        .get('/api/v1/timetable/my-schedule')
        .set('Authorization', `Bearer ${teacherToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.grid).toBeDefined();
      expect(res.body.data.summary).toBeDefined();
    });
  });

  describe('Input Validation', () => {
    it('should reject creation with missing required fields', async () => {
      const res = await request(app)
        .post('/api/v1/timetable')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          classId: class1Id,
          subject: '',
        });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject invalid day of week', async () => {
      const res = await request(app)
        .post('/api/v1/timetable')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          classId: class1Id,
          teacherId,
          subject: 'Science',
          dayOfWeek: 'SUNDAY',
          startTime: '09:00',
          endTime: '10:00',
        });
      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Invalid dayOfWeek');
    });

    it('should reject malformed time strings', async () => {
      const res = await request(app)
        .post('/api/v1/timetable')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          classId: class1Id,
          teacherId,
          subject: 'Science',
          dayOfWeek: 'MONDAY',
          startTime: '9:00 AM',
          endTime: '10:00',
        });
      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Invalid startTime');
    });

    it('should reject startTime >= endTime', async () => {
      const res = await request(app)
        .post('/api/v1/timetable')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          classId: class1Id,
          teacherId,
          subject: 'Social Science',
          dayOfWeek: 'MONDAY',
          startTime: '11:00',
          endTime: '10:00',
        });
      expect(res.status).toBe(400);
      expect(res.body.message).toContain('earlier than endTime');
    });

    it('should reject duration under 15 minutes', async () => {
      const res = await request(app)
        .post('/api/v1/timetable')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          classId: class1Id,
          teacherId,
          subject: 'Roll Call',
          dayOfWeek: 'MONDAY',
          startTime: '09:00',
          endTime: '09:10',
        });
      expect(res.status).toBe(400);
      expect(res.body.message).toContain('at least 15 minutes');
    });
  });

  describe('Timetable Creation & Conflict Detection', () => {
    it('should allow ADMIN to create a valid timetable entry', async () => {
      const res = await request(app)
        .post('/api/v1/timetable')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          classId: class1Id,
          teacherId,
          subject: 'Mathematics',
          dayOfWeek: 'MONDAY',
          startTime: '09:00',
          endTime: '10:00',
          roomNumber: 'Room 101',
          notes: 'Standard morning lecture',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.subject).toBe('Mathematics');
      expect(res.body.data.dayOfWeek).toBe('MONDAY');
      expect(res.body.data.startTime).toBe('09:00');
      expect(res.body.data.endTime).toBe('10:00');
      expect(res.body.data.roomNumber).toBe('Room 101');
      createdEntryId = res.body.data.id;
    });

    it('should reject conflict: Teacher cannot have overlapping classes (409)', async () => {
      // Same teacher, same day, overlapping time (09:30-10:30 overlaps with 09:00-10:00)
      const res = await request(app)
        .post('/api/v1/timetable')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          classId: class2Id,
          teacherId, // Same teacher
          subject: 'Advanced Algebra',
          dayOfWeek: 'MONDAY',
          startTime: '09:30',
          endTime: '10:30',
          roomNumber: 'Room 102',
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('already scheduled');
      expect(res.body.conflicts[0].type).toBe('TEACHER_CONFLICT');
    });

    it('should reject conflict: Class cannot have two simultaneous lessons (409)', async () => {
      // Same class (class1Id), different teacher, overlapping time (09:15-10:15)
      const res = await request(app)
        .post('/api/v1/timetable')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          classId: class1Id, // Same class
          teacherId: teacher2Id, // Different teacher
          subject: 'English Literature',
          dayOfWeek: 'MONDAY',
          startTime: '09:15',
          endTime: '10:15',
          roomNumber: 'Room 201',
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('already has');
      expect(res.body.conflicts[0].type).toBe('CLASS_CONFLICT');
    });

    it('should reject conflict: Room cannot be double-booked (409)', async () => {
      // Different class, different teacher, same room ("Room 101"), overlapping time
      const res = await request(app)
        .post('/api/v1/timetable')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          classId: class2Id,
          teacherId: teacher2Id,
          subject: 'General Science',
          dayOfWeek: 'MONDAY',
          startTime: '09:00',
          endTime: '09:45',
          roomNumber: 'Room 101', // Same room
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('already booked');
      expect(res.body.conflicts[0].type).toBe('ROOM_CONFLICT');
    });

    it('should permit non-overlapping adjacent slots without conflict', async () => {
      // Same teacher and same room, but adjacent time (10:00 to 11:00)
      const res = await request(app)
        .post('/api/v1/timetable')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          classId: class2Id,
          teacherId,
          subject: 'Physics',
          dayOfWeek: 'MONDAY',
          startTime: '10:00',
          endTime: '11:00',
          roomNumber: 'Room 101',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.startTime).toBe('10:00');
    });

    it('should permit same time slot on a different day', async () => {
      // Same class and teacher, but TUESDAY instead of MONDAY
      const res = await request(app)
        .post('/api/v1/timetable')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          classId: class1Id,
          teacherId,
          subject: 'Mathematics',
          dayOfWeek: 'TUESDAY',
          startTime: '09:00',
          endTime: '10:00',
          roomNumber: 'Room 101',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });
  });

  describe('Pre-flight Slot Conflict Validation', () => {
    it('should return isValid: false with conflict breakdown for overlapping proposed slot', async () => {
      const res = await request(app)
        .post('/api/v1/timetable/validate-slot')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          classId: class1Id,
          teacherId,
          dayOfWeek: 'MONDAY',
          startTime: '09:15',
          endTime: '09:45',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.isValid).toBe(false);
      expect(res.body.data.conflicts.length).toBeGreaterThan(0);
    });

    it('should return isValid: true for available prospective time slot', async () => {
      const res = await request(app)
        .post('/api/v1/timetable/validate-slot')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          classId: class1Id,
          teacherId,
          dayOfWeek: 'WEDNESDAY',
          startTime: '14:00',
          endTime: '15:00',
          roomNumber: 'Lab 1',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.isValid).toBe(true);
      expect(res.body.data.conflicts.length).toBe(0);
    });
  });

  describe('Weekly Grid, Querying & Filtering', () => {
    it('should retrieve structured weekly timetable grid grouped Monday through Saturday', async () => {
      const res = await request(app)
        .get('/api/v1/timetable/weekly')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.grid).toBeDefined();
      expect(Array.isArray(res.body.data.grid.MONDAY)).toBe(true);
      expect(Array.isArray(res.body.data.grid.TUESDAY)).toBe(true);
      expect(Array.isArray(res.body.data.grid.WEDNESDAY)).toBe(true);
      expect(res.body.data.grid.MONDAY.length).toBe(2);
      expect(res.body.data.summary.totalEntries).toBeGreaterThanOrEqual(3);
    });

    it('should filter weekly grid by classId', async () => {
      const res = await request(app)
        .get(`/api/v1/timetable/weekly?classId=${class1Id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      res.body.data.grid.MONDAY.forEach((entry) => {
        expect(entry.classId).toBe(class1Id);
      });
    });

    it('should filter weekly grid by teacherId', async () => {
      const res = await request(app)
        .get(`/api/v1/timetable/weekly?teacherId=${teacherId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      res.body.data.grid.MONDAY.forEach((entry) => {
        expect(entry.teacherId).toBe(teacherId);
      });
    });

    it('should list timetable entries with search query', async () => {
      const res = await request(app)
        .get('/api/v1/timetable?search=Mathematics')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      res.body.data.forEach((entry) => {
        expect(entry.subject).toContain('Mathematics');
      });
    });
  });

  describe('Update & Delete Lifecycle', () => {
    it('should allow ADMIN to update an existing timetable entry', async () => {
      const res = await request(app)
        .put(`/api/v1/timetable/${createdEntryId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          subject: 'Pure Mathematics',
          roomNumber: 'Room 105',
          notes: 'Updated classroom allocation',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.subject).toBe('Pure Mathematics');
      expect(res.body.data.roomNumber).toBe('Room 105');
    });

    it('should reject update if it creates a conflict with another entry', async () => {
      // Trying to move createdEntryId to 10:00-11:00 where Physics is already scheduled
      const res = await request(app)
        .put(`/api/v1/timetable/${createdEntryId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          startTime: '10:00',
          endTime: '11:00',
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });

    it('should return 404 when updating non-existent timetable entry', async () => {
      const res = await request(app)
        .put('/api/v1/timetable/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ subject: 'Ghost Class' });

      expect(res.status).toBe(404);
    });

    it('should allow ADMIN to delete a timetable entry', async () => {
      const res = await request(app)
        .delete(`/api/v1/timetable/${createdEntryId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(createdEntryId);

      // Verify deletion
      const checkRes = await request(app)
        .get(`/api/v1/timetable/${createdEntryId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(checkRes.status).toBe(404);
    });

    it('should return 404 when deleting already deleted entry', async () => {
      const res = await request(app)
        .delete(`/api/v1/timetable/${createdEntryId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });
  });
});
