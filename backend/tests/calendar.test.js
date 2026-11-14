import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/config/db.js';

describe('School Academic Calendar & Holiday Management API', () => {
  let adminToken;
  let teacherToken;
  let createdEventId;

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

    // Clean up test events
    await prisma.academicEvent.deleteMany({});
  });

  afterAll(async () => {
    await prisma.academicEvent.deleteMany({});
  });

  describe('Authentication & Role-Based Access', () => {
    it('should reject unauthenticated request with 401', async () => {
      const res = await request(app).get('/api/v1/calendar');
      expect(res.status).toBe(401);
    });

    it('should reject non-admin (TEACHER) event creation with 403', async () => {
      const res = await request(app)
        .post('/api/v1/calendar')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          title: 'Republic Day Celebration',
          type: 'HOLIDAY',
          startDate: '2026-01-26',
          endDate: '2026-01-26',
        });
      expect(res.status).toBe(403);
    });

    it('should allow TEACHER to read academic events', async () => {
      const res = await request(app)
        .get('/api/v1/calendar')
        .set('Authorization', `Bearer ${teacherToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('Input Validation & Error Handling', () => {
    it('should reject creation with missing title', async () => {
      const res = await request(app)
        .post('/api/v1/calendar')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          type: 'HOLIDAY',
          startDate: '2026-01-26',
          endDate: '2026-01-26',
        });
      expect(res.status).toBe(400);
      expect(res.body.message).toContain('title is required');
    });

    it('should reject invalid event type', async () => {
      const res = await request(app)
        .post('/api/v1/calendar')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Sports Gala',
          type: 'CARNIVAL',
          startDate: '2026-02-10',
          endDate: '2026-02-11',
        });
      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Invalid event type');
    });

    it('should reject startDate after endDate', async () => {
      const res = await request(app)
        .post('/api/v1/calendar')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Midterm Examination',
          type: 'EXAM',
          startDate: '2026-03-20',
          endDate: '2026-03-10',
        });
      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Start date cannot be after end date');
    });
  });

  describe('CRUD Lifecycle & Duplicate Prevention', () => {
    it('should allow ADMIN to create a valid academic holiday event', async () => {
      const res = await request(app)
        .post('/api/v1/calendar')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Republic Day Holiday',
          description: 'National holiday in commemoration of the Constitution',
          type: 'HOLIDAY',
          startDate: '2026-01-26',
          endDate: '2026-01-26',
          isHoliday: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.title).toBe('Republic Day Holiday');
      expect(res.body.data.type).toBe('HOLIDAY');
      expect(res.body.data.isHoliday).toBe(true);
      createdEventId = res.body.data.id;
    });

    it('should reject duplicate event with same title on the same start date (409)', async () => {
      const res = await request(app)
        .post('/api/v1/calendar')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Republic Day Holiday',
          type: 'HOLIDAY',
          startDate: '2026-01-26',
          endDate: '2026-01-26',
        });

      expect(res.status).toBe(409);
      expect(res.body.message).toContain('already scheduled on this start date');
    });

    it('should allow ADMIN to create an examination event', async () => {
      const res = await request(app)
        .post('/api/v1/calendar')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Annual Board Assessment Exams',
          type: 'EXAM',
          startDate: '2026-03-01',
          endDate: '2026-03-15',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.type).toBe('EXAM');
    });

    it('should filter events by date range', async () => {
      const res = await request(app)
        .get('/api/v1/calendar?startDate=2026-01-01&endDate=2026-01-31')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].title).toBe('Republic Day Holiday');
    });

    it('should allow ADMIN to update an existing academic event', async () => {
      const res = await request(app)
        .put(`/api/v1/calendar/${createdEventId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: '77th Republic Day National Holiday',
          description: 'Flag hoisting ceremony at 8:00 AM followed by national holiday.',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.title).toBe('77th Republic Day National Holiday');
      expect(res.body.data.description).toContain('Flag hoisting');
    });

    it('should return 404 when updating non-existent event', async () => {
      const res = await request(app)
        .put('/api/v1/calendar/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'Ghost Holiday' });
      expect(res.status).toBe(404);
    });

    it('should allow ADMIN to delete an academic event', async () => {
      const res = await request(app)
        .delete(`/api/v1/calendar/${createdEventId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(createdEventId);

      // Verify 404 on subsequent get
      const checkRes = await request(app)
        .get(`/api/v1/calendar/${createdEventId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(checkRes.status).toBe(404);
    });
  });
});
