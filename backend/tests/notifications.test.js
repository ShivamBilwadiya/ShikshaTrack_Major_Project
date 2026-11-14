import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';

describe('School Notification & Alert Management API', () => {
  let adminToken;
  let teacherToken;
  let teacherId;
  let createdNotificationId;
  let teacherNotificationId;

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
  });

  describe('POST /api/v1/notifications - Creation & Permissions', () => {
    it('should allow ADMIN to create a broadcast notification', async () => {
      const res = await request(app)
        .post('/api/v1/notifications')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'District Midday Meal Inspection',
          message: 'District officials will conduct a nutritional inspection this Friday.',
          category: 'INFO',
          type: 'GENERAL_ANNOUNCEMENT',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.title).toBe('District Midday Meal Inspection');
      expect(res.body.data.category).toBe('INFO');
      expect(res.body.data.isRead).toBe(false);
      createdNotificationId = res.body.data.id;
    });

    it('should allow ADMIN to create a targeted notification for a specific teacher', async () => {
      const res = await request(app)
        .post('/api/v1/notifications')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          userId: teacherId,
          title: 'Class 8-A Register Review',
          message: 'Please verify the roll call records for Class 8-A.',
          category: 'WARNING',
          type: 'INCOMPLETE_SESSION',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.userId).toBe(teacherId);
      expect(res.body.data.category).toBe('WARNING');
      teacherNotificationId = res.body.data.id;
    });

    it('should reject notification creation from non-admin (TEACHER role) with 403', async () => {
      const res = await request(app)
        .post('/api/v1/notifications')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          title: 'Unauthorized Notice',
          message: 'Teacher should not be able to broadcast notices.',
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('should reject notification creation with missing title or message', async () => {
      const res = await request(app)
        .post('/api/v1/notifications')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          category: 'INFO',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Title and message are required');
    });

    it('should reject invalid notification categories', async () => {
      const res = await request(app)
        .post('/api/v1/notifications')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Invalid Category Alert',
          message: 'Testing category validation failure.',
          category: 'INVALID_CATEGORY',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Invalid notification category');
    });
  });

  describe('GET /api/v1/notifications - Retrieval, Filtering & Pagination', () => {
    it('should list notifications for ADMIN with pagination metadata', async () => {
      const res = await request(app)
        .get('/api/v1/notifications?page=1&limit=10')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.notifications)).toBe(true);
      expect(res.body.data.pagination).toBeDefined();
      expect(res.body.data.pagination.page).toBe(1);
      expect(res.body.data.summary).toBeDefined();
    });

    it('should scope notifications for TEACHER to broadcast and their own only', async () => {
      const res = await request(app)
        .get('/api/v1/notifications')
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      // Every notification returned must either be targeted to this teacher or be broadcast (null)
      for (const notif of res.body.data.notifications) {
        expect([teacherId, null]).toContain(notif.userId);
      }
    });

    it('should filter notifications by category', async () => {
      const res = await request(app)
        .get('/api/v1/notifications?category=WARNING')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      for (const notif of res.body.data.notifications) {
        expect(notif.category).toBe('WARNING');
      }
    });

    it('should filter notifications by status (UNREAD vs READ)', async () => {
      const res = await request(app)
        .get('/api/v1/notifications?status=UNREAD')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      for (const notif of res.body.data.notifications) {
        expect(notif.isRead).toBe(false);
      }
    });

    it('should filter notifications by date range and reject inverted dates', async () => {
      const validRes = await request(app)
        .get('/api/v1/notifications?startDate=2026-01-01&endDate=2026-12-31')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(validRes.status).toBe(200);

      const invalidRes = await request(app)
        .get('/api/v1/notifications?startDate=2026-12-31&endDate=2026-01-01')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(invalidRes.status).toBe(400);
      expect(invalidRes.body.message).toContain('End date cannot be before start date');
    });

    it('should support search across title and message', async () => {
      const res = await request(app)
        .get('/api/v1/notifications?search=Midday')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.notifications.some((n) => n.title.includes('Midday'))).toBe(true);
    });
  });

  describe('GET /api/v1/notifications/summary - Dashboard Center Summary', () => {
    it('should return unread counts and recent notification preview', async () => {
      const res = await request(app)
        .get('/api/v1/notifications/summary')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(typeof res.body.data.unreadCount).toBe('number');
      expect(typeof res.body.data.urgentCount).toBe('number');
      expect(typeof res.body.data.warningCount).toBe('number');
      expect(Array.isArray(res.body.data.recentNotifications)).toBe(true);
    });

    it('should return role-scoped summary counts for teachers', async () => {
      const res = await request(app)
        .get('/api/v1/notifications/summary')
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(typeof res.body.data.unreadCount).toBe('number');
    });
  });

  describe('PATCH /api/v1/notifications/:id/read - Read Status Management', () => {
    it('should mark a single notification as read', async () => {
      const res = await request(app)
        .patch(`/api/v1/notifications/${createdNotificationId}/read`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isRead).toBe(true);
      expect(res.body.data.readAt).toBeDefined();
    });

    it('should return 404 when marking non-existent notification as read', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000099';
      const res = await request(app)
        .patch(`/api/v1/notifications/${nonExistentId}/read`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('should allow TEACHER to mark their assigned notification as read', async () => {
      const res = await request(app)
        .patch(`/api/v1/notifications/${teacherNotificationId}/read`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.isRead).toBe(true);
    });

    it('PATCH /api/v1/notifications/read-all - should mark all unread notifications as read', async () => {
      // Create fresh unread notification first
      await request(app)
        .post('/api/v1/notifications')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Bulk Read Test',
          message: 'Testing bulk read update.',
          category: 'INFO',
        });

      const res = await request(app)
        .patch('/api/v1/notifications/read-all')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ category: 'INFO' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(typeof res.body.data.updatedCount).toBe('number');
    });
  });

  describe('POST /api/v1/notifications/generate-alerts - Proactive Alert Engine', () => {
    it('should scan attendance database and automatically generate alerts for low attendance & incomplete sessions', async () => {
      const res = await request(app)
        .post('/api/v1/notifications/generate-alerts')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(typeof res.body.data.generatedCount).toBe('number');
      expect(res.body.data.details).toBeDefined();
      expect(typeof res.body.data.details.lowAttendanceCount).toBe('number');
      expect(typeof res.body.data.details.incompleteSessionCount).toBe('number');
    });
  });

  describe('DELETE /api/v1/notifications/:id - Dismissal & Lifecycle Management', () => {
    it('should allow dismissing a notification', async () => {
      const res = await request(app)
        .delete(`/api/v1/notifications/${createdNotificationId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('dismissed successfully');

      // Verify it is gone
      const checkRes = await request(app)
        .patch(`/api/v1/notifications/${createdNotificationId}/read`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(checkRes.status).toBe(404);
    });

    it('should return 404 when deleting a non-existent notification', async () => {
      const nonExistent = '00000000-0000-0000-0000-000000000099';
      const res = await request(app)
        .delete(`/api/v1/notifications/${nonExistent}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });
});
