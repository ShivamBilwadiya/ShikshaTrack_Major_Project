import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';

describe('Attendance Analytics Date Range & Filtering API', () => {
  let adminToken;
  let teacherToken;

  beforeAll(async () => {
    // 1. Admin login
    const adminRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@shikshatrack.in', password: 'admin123' });
    adminToken = adminRes.body.data.token;

    // 2. Teacher login
    const teacherRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'ramesh.teacher@shikshatrack.in', password: 'teacher123' });
    teacherToken = teacherRes.body.data.token;
  });

  it('GET /api/v1/analytics/admin - should return default analytics for today when no date range is provided', async () => {
    const res = await request(app)
      .get('/api/v1/analytics/admin')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.overview).toBeDefined();
    expect(res.body.data.overview.totalStudents).toBeGreaterThan(0);
    expect(res.body.data.overview.dateRange).toBeDefined();
    expect(res.body.data.overview.dateRange.isCustomRange).toBe(false);
    expect(Array.isArray(res.body.data.classBreakdown)).toBe(true);
    expect(Array.isArray(res.body.data.trend)).toBe(true);
  });

  it('GET /api/v1/analytics/admin - should filter analytics by valid date range', async () => {
    const res = await request(app)
      .get('/api/v1/analytics/admin?startDate=2026-11-01&endDate=2026-11-30')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.overview.dateRange.isCustomRange).toBe(true);
    expect(res.body.data.overview.dateRange.startDate).toBe('2026-11-01');
    expect(res.body.data.overview.dateRange.endDate).toBe('2026-11-30');
    expect(typeof res.body.data.overview.dateRange.totalSessions).toBe('number');
    expect(Array.isArray(res.body.data.classBreakdown)).toBe(true);
    expect(Array.isArray(res.body.data.trend)).toBe(true);
  });

  it('GET /api/v1/analytics/admin - should reject invalid date range where endDate is before startDate', async () => {
    const res = await request(app)
      .get('/api/v1/analytics/admin?startDate=2026-11-30&endDate=2026-11-01')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('End date cannot be before start date');
  });

  it('GET /api/v1/analytics/admin - should reject malformed date strings', async () => {
    const res1 = await request(app)
      .get('/api/v1/analytics/admin?startDate=invalid-date-format')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res1.status).toBe(400);
    expect(res1.body.success).toBe(false);
    expect(res1.body.message).toContain('Invalid start date format');

    const res2 = await request(app)
      .get('/api/v1/analytics/admin?endDate=invalid-date-format')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res2.status).toBe(400);
    expect(res2.body.success).toBe(false);
    expect(res2.body.message).toContain('Invalid end date format');
  });

  it('GET /api/v1/analytics/admin - should return empty results when no sessions exist in the selected range', async () => {
    const res = await request(app)
      .get('/api/v1/analytics/admin?startDate=2099-01-01&endDate=2099-01-10')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.overview.dateRange.isCustomRange).toBe(true);
    expect(res.body.data.overview.dateRange.totalSessions).toBe(0);
    expect(res.body.data.overview.todayPresent).toBe(0);
    expect(res.body.data.overview.todayAbsent).toBe(0);
    expect(res.body.data.overview.todayLate).toBe(0);
    expect(res.body.data.classBreakdown.length).toBe(0);
    expect(res.body.data.trend.length).toBe(0);
  });

  it('GET /api/v1/analytics/teacher - should support date range filtering and validation for teachers', async () => {
    // Valid date range
    const validRes = await request(app)
      .get('/api/v1/analytics/teacher?startDate=2026-11-01&endDate=2026-11-30')
      .set('Authorization', `Bearer ${teacherToken}`);

    expect(validRes.status).toBe(200);
    expect(validRes.body.success).toBe(true);
    expect(Array.isArray(validRes.body.data.assignedClasses)).toBe(true);

    // Invalid date range
    const invalidRes = await request(app)
      .get('/api/v1/analytics/teacher?startDate=2026-12-31&endDate=2026-01-01')
      .set('Authorization', `Bearer ${teacherToken}`);

    expect(invalidRes.status).toBe(400);
    expect(invalidRes.body.success).toBe(false);
    expect(invalidRes.body.message).toContain('End date cannot be before start date');
  });

  describe('Comprehensive Student Attendance & Performance Insights', () => {
    let studentId;
    let classId;

    beforeAll(async () => {
      const studentRes = await request(app)
        .get('/api/v1/students?limit=1')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(studentRes.status).toBe(200);
      const student = studentRes.body.data.students[0];
      studentId = student.id;
      classId = student.classId;
    });

    it('GET /api/v1/analytics/students - should return student attendance insights with default 75% threshold', async () => {
      const res = await request(app)
        .get('/api/v1/analytics/students')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.summary).toBeDefined();
      expect(res.body.data.summary.threshold).toBe(75);
      expect(typeof res.body.data.summary.totalAnalyzed).toBe('number');
      expect(typeof res.body.data.summary.averageAttendance).toBe('number');
      expect(Array.isArray(res.body.data.students)).toBe(true);

      if (res.body.data.students.length > 0) {
        const first = res.body.data.students[0];
        expect(first.studentId).toBeDefined();
        expect(first.name).toBeDefined();
        expect(first.attendanceRate).toBeGreaterThanOrEqual(0);
        expect(first.trend).toBeDefined();
        expect(Array.isArray(first.insights)).toBe(true);
      }
    });

    it('GET /api/v1/analytics/students - should support configurable threshold and boundary validation', async () => {
      // Valid custom threshold
      const res85 = await request(app)
        .get('/api/v1/analytics/students?threshold=85')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res85.status).toBe(200);
      expect(res85.body.data.summary.threshold).toBe(85);

      // Invalid negative threshold
      const resNeg = await request(app)
        .get('/api/v1/analytics/students?threshold=-5')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(resNeg.status).toBe(400);
      expect(resNeg.body.message).toContain('between 0 and 100');

      // Invalid excessive threshold
      const resHigh = await request(app)
        .get('/api/v1/analytics/students?threshold=105')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(resHigh.status).toBe(400);
      expect(resHigh.body.message).toContain('between 0 and 100');
    });

    it('GET /api/v1/analytics/students - should filter by classId and search term', async () => {
      const res = await request(app)
        .get(`/api/v1/analytics/students?classId=${classId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.students.every((s) => s.class.id === classId)).toBe(true);

      // Search
      const searchRes = await request(app)
        .get('/api/v1/analytics/students?search=Aarav')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(searchRes.status).toBe(200);
      if (searchRes.body.data.students.length > 0) {
        expect(searchRes.body.data.students[0].name).toContain('Aarav');
      }
    });

    it('GET /api/v1/analytics/students - should support pagination metadata', async () => {
      const res = await request(app)
        .get('/api/v1/analytics/students?page=1&limit=2')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.pagination).toBeDefined();
      expect(res.body.data.pagination.page).toBe(1);
      expect(res.body.data.pagination.limit).toBe(2);
      expect(res.body.data.students.length).toBeLessThanOrEqual(2);
    });

    it('GET /api/v1/analytics/students/:id - should return in-depth attendance details, weekday analysis and recommendations', async () => {
      const res = await request(app)
        .get(`/api/v1/analytics/students/${studentId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.student.id).toBe(studentId);
      expect(res.body.data.metrics).toBeDefined();
      expect(Array.isArray(res.body.data.dayOfWeekAnalytics)).toBe(true);
      expect(res.body.data.dayOfWeekAnalytics.length).toBe(5);
      expect(Array.isArray(res.body.data.monthlyTrends)).toBe(true);
      expect(Array.isArray(res.body.data.recommendations)).toBe(true);
    });

    it('GET /api/v1/analytics/students/:id - should return 404 for non-existent student ID', async () => {
      const nonExistent = '00000000-0000-0000-0000-000000000000';
      const res = await request(app)
        .get(`/api/v1/analytics/students/${nonExistent}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Student not found');
    });

    it('GET /api/v1/analytics/cohorts - should return class comparison rankings and performance tiers', async () => {
      const res = await request(app)
        .get('/api/v1/analytics/cohorts')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(typeof res.body.data.totalClasses).toBe('number');
      expect(Array.isArray(res.body.data.classComparisons)).toBe(true);

      if (res.body.data.classComparisons.length > 0) {
        const cls = res.body.data.classComparisons[0];
        expect(cls.className).toBeDefined();
        expect(typeof cls.attendanceRate).toBe('number');
        expect(['HIGH', 'MODERATE', 'LOW']).toContain(cls.performanceTier);
      }
    });
  });
});
