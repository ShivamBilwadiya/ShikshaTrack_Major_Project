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
});
