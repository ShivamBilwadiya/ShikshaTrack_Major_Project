import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/config/db.js';

describe('Advanced Attendance Analytics & Reporting Intelligence', () => {
  let adminToken;
  let teacherToken;
  let sampleClassId;

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

    // 3. Resolve active class
    const student = await prisma.student.findFirst({ where: { active: true } });
    sampleClassId = student.classId;
  });

  describe('1. Security & Authentication', () => {
    it('should reject unauthenticated request with 401', async () => {
      const res = await request(app).get('/api/v1/analytics/attendance/overview');
      expect(res.status).toBe(401);
    });

    it('should allow authenticated users to fetch attendance overview', async () => {
      const res = await request(app)
        .get('/api/v1/analytics/attendance/overview')
        .set('Authorization', `Bearer ${teacherToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.metrics).toBeDefined();
      expect(typeof res.body.data.metrics.overallAttendanceRate).toBe('number');
    });
  });

  describe('2. Attendance Overview & Distribution', () => {
    it('should return metrics, category breakdown and comparative trend', async () => {
      const res = await request(app)
        .get('/api/v1/analytics/attendance/overview')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const { metrics, distribution, interval } = res.body.data;
      expect(metrics).toHaveProperty('overallAttendanceRate');
      expect(metrics).toHaveProperty('trend');
      expect(metrics).toHaveProperty('presentCount');
      expect(metrics).toHaveProperty('absentCount');
      expect(metrics).toHaveProperty('approvedLeaveDays');
      expect(Array.isArray(distribution)).toBe(true);
      expect(interval).toHaveProperty('startDate');
      expect(interval).toHaveProperty('endDate');
    });

    it('should filter overview metrics by specific classId', async () => {
      const res = await request(app)
        .get(`/api/v1/analytics/attendance/overview?classId=${sampleClassId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.metrics).toBeDefined();
    });
  });

  describe('3. Attendance Trends Intelligence', () => {
    it('should return grouped daily attendance trends', async () => {
      const res = await request(app)
        .get('/api/v1/analytics/attendance/trends?interval=daily')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.interval).toBe('daily');
      expect(Array.isArray(res.body.data.trends)).toBe(true);
    });

    it('should return grouped monthly attendance trends', async () => {
      const res = await request(app)
        .get('/api/v1/analytics/attendance/trends?interval=monthly')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.interval).toBe('monthly');
      expect(Array.isArray(res.body.data.trends)).toBe(true);
    });
  });

  describe('4. Class-wise Comparisons', () => {
    it('should return attendance comparisons across all classes', async () => {
      const res = await request(app)
        .get('/api/v1/analytics/attendance/classes')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      if (res.body.data.length > 0) {
        const first = res.body.data[0];
        expect(first).toHaveProperty('className');
        expect(first).toHaveProperty('enrolledStudents');
        expect(first).toHaveProperty('attendanceRate');
        expect(first).toHaveProperty('status');
      }
    });
  });

  describe('5. Student Summaries & At-Risk Intelligence', () => {
    it('should return paginated student attendance summaries', async () => {
      const res = await request(app)
        .get('/api/v1/analytics/attendance/students?page=1&limit=10')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.students)).toBe(true);
      expect(res.body.data.pagination).toBeDefined();
      if (res.body.data.students.length > 0) {
        const st = res.body.data.students[0];
        expect(st).toHaveProperty('attendanceRate');
        expect(st).toHaveProperty('consecutiveAbsences');
        expect(st).toHaveProperty('isAtRisk');
      }
    });

    it('should detect at-risk students below threshold', async () => {
      const res = await request(app)
        .get('/api/v1/analytics/attendance/at-risk?threshold=80&minConsecutive=2')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('threshold', 80);
      expect(res.body.data).toHaveProperty('atRiskCount');
      expect(Array.isArray(res.body.data.students)).toBe(true);
    });
  });

  describe('6. CSV Reporting Exports', () => {
    it('should export student attendance summaries to RFC-4180 CSV', async () => {
      const res = await request(app)
        .get('/api/v1/analytics/attendance/export?type=students')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/text\/csv/);
      expect(res.text).toContain('Admission No,Student Name,Roll No,Class');
    });

    it('should export class attendance comparisons to RFC-4180 CSV', async () => {
      const res = await request(app)
        .get('/api/v1/analytics/attendance/export?type=classes')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/text\/csv/);
      expect(res.text).toContain('Class Name,Enrolled Students,Sessions Held');
    });

    it('should export at-risk student records to RFC-4180 CSV', async () => {
      const res = await request(app)
        .get('/api/v1/analytics/attendance/export?type=at-risk')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/text\/csv/);
      expect(res.text).toContain('Admission No,Student Name,Class,Attendance Rate (%)');
    });
  });
});
