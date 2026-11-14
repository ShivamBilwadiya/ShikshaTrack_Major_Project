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

  it('GET /api/v1/reports/daily/csv - should export detailed attendance CSV with student name, admission number, date, and status', async () => {
    const res = await request(app)
      .get('/api/v1/reports/daily/csv')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.text).toContain('"Student Name"');
    expect(res.text).toContain('"Admission Number"');
    expect(res.text).toContain('"Attendance Date"');
    expect(res.text).toContain('"Attendance Status"');
  });

  it('GET /api/v1/reports/daily/csv - should respect status and classId filters in CSV export', async () => {
    const res = await request(app)
      .get('/api/v1/reports/daily/csv?status=PRESENT')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    const lines = res.text.trim().split('\n');
    expect(lines.length).toBeGreaterThanOrEqual(1); // Header line present

    // Any returned data lines must have status PRESENT
    if (lines.length > 1) {
      lines.slice(1).forEach((line) => {
        expect(line).toContain('"PRESENT"');
        expect(line).not.toContain('"ABSENT"');
      });
    }
  });

  it('GET /api/v1/reports/daily/csv - should handle empty reports with proper headers and zero data rows', async () => {
    const res = await request(app)
      .get('/api/v1/reports/daily/csv?date=2099-01-01')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    const lines = res.text.trim().split('\n');
    expect(lines.length).toBe(1); // Only header row
    expect(lines[0]).toContain('"Student Name"');
    expect(lines[0]).toContain('"Admission Number"');
  });

  it('GET /api/v1/reports/daily/csv?view=summary - should preserve class-level summary export', async () => {
    const res = await request(app)
      .get('/api/v1/reports/daily/csv?view=summary')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.text).toContain('Class,Enrolled,Status,Teacher,Present,Late,Absent,Unmarked,Attendance Rate,Mid-Day Meals');
  });
});

