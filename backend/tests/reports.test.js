import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';

describe('Reporting & SQL Aggregations API', () => {
  let adminToken;

  beforeAll(async () => {
    const adminRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@shikshatrack.in', password: 'admin123' });
    adminToken = adminRes.body.data.token;
  });

  it('GET /api/v1/reports/daily - should compute accurate daily attendance summary', async () => {
    const res = await request(app)
      .get('/api/v1/reports/daily')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.summary).toBeDefined();
    expect(res.body.data.summary.totalEnrolled).toBeGreaterThan(0);
    expect(res.body.data.summary.overallAttendanceRate).toBeGreaterThanOrEqual(0);
    expect(res.body.data.summary.midDayMealTotalHeadcount).toBeDefined();
  });

  it('GET /api/v1/reports/low-attendance - should flag students below 75% threshold', async () => {
    const res = await request(app)
      .get('/api/v1/reports/low-attendance?threshold=75')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.threshold).toBe(75);
    expect(Array.isArray(res.body.data.students)).toBe(true);
  });

  it('GET /api/v1/reports/mid-day-meal - should compute physical meal headcounts', async () => {
    const res = await request(app)
      .get('/api/v1/reports/mid-day-meal')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.report)).toBe(true);
  });
});

