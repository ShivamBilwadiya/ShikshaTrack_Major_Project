import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/config/db.js';

describe('Student Leave, Attendance & Discipline Management System', () => {
  let adminToken;
  let teacherToken;
  let sampleClassId;
  let sampleStudent1Id;
  let sampleStudent2Id;
  let teacherUserId;
  let testLeave1Id;
  let testLeave2Id;
  let testIncidentId;

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
    teacherUserId = teacherRes.body.data.user.id;

    // 3. Resolve active students & class
    const student1 = await prisma.student.findFirst({ where: { active: true } });
    sampleClassId = student1.classId;
    const students = await prisma.student.findMany({
      where: { classId: sampleClassId, active: true },
      take: 2,
    });
    sampleStudent1Id = students[0].id;
    sampleStudent2Id = students.length > 1 ? students[1].id : students[0].id;

    // Assign teacher to this class if not already assigned
    await prisma.teacherAssignment.upsert({
      where: {
        teacherId_classId: {
          teacherId: teacherUserId,
          classId: sampleClassId,
        },
      },
      update: {},
      create: {
        teacherId: teacherUserId,
        classId: sampleClassId,
        isClassTeacher: true,
      },
    });

    // Clean up past test leaves and incidents
    await prisma.studentLeaveDecision.deleteMany({});
    await prisma.studentLeave.deleteMany({});
    await prisma.incidentActionHistory.deleteMany({});
    await prisma.studentIncident.deleteMany({});
  });

  afterAll(async () => {
    await prisma.studentLeaveDecision.deleteMany({});
    await prisma.studentLeave.deleteMany({});
    await prisma.incidentActionHistory.deleteMany({});
    await prisma.studentIncident.deleteMany({});
  });

  describe('1. Authentication & Security', () => {
    it('should reject unauthenticated leave requests with 401', async () => {
      const res = await request(app).get('/api/v1/leaves');
      expect(res.status).toBe(401);
    });

    it('should reject unauthenticated incident requests with 401', async () => {
      const res = await request(app).get('/api/v1/incidents');
      expect(res.status).toBe(401);
    });

    it('should allow authenticated users to view leave listing', async () => {
      const res = await request(app)
        .get('/api/v1/leaves')
        .set('Authorization', `Bearer ${teacherToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.leaves)).toBe(true);
    });
  });

  describe('2. Leave Application & Validation', () => {
    it('should reject leave application when missing required fields', async () => {
      const res = await request(app)
        .post('/api/v1/leaves')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          studentId: sampleStudent1Id,
          // Missing startDate, endDate, reason
        });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject leave application when startDate is after endDate', async () => {
      const res = await request(app)
        .post('/api/v1/leaves')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          studentId: sampleStudent1Id,
          leaveType: 'SICK',
          startDate: '2026-11-20',
          endDate: '2026-11-15',
          reason: 'Fever and cold',
        });
      expect(res.status).toBe(500);
      expect(res.body.message).toMatch(/cannot be after end date/i);
    });

    it('should successfully apply for a valid student leave', async () => {
      const res = await request(app)
        .post('/api/v1/leaves')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          studentId: sampleStudent1Id,
          leaveType: 'SICK',
          startDate: '2026-11-16',
          endDate: '2026-11-18',
          reason: 'Severe viral fever doctor recommended rest',
          documentUrl: 'https://example.com/doctor_note.pdf',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('PENDING');
      expect(res.body.data.totalDays).toBe(3);
      expect(res.body.data.leaveType).toBe('SICK');
      testLeave1Id = res.body.data.id;
    });

    it('should prevent overlapping leave application for the same student', async () => {
      const res = await request(app)
        .post('/api/v1/leaves')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          studentId: sampleStudent1Id,
          leaveType: 'PERSONAL',
          startDate: '2026-11-17',
          endDate: '2026-11-19',
          reason: 'Family wedding overlap test',
        });

      expect(res.status).toBe(500);
      expect(res.body.message).toMatch(/overlapping leave is not allowed/i);
    });

    it('should allow non-overlapping leave application for a different student', async () => {
      const res = await request(app)
        .post('/api/v1/leaves')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          studentId: sampleStudent2Id,
          leaveType: 'FAMILY',
          startDate: '2026-11-16',
          endDate: '2026-11-16',
          reason: 'Family ceremony',
        });

      expect(res.status).toBe(201);
      testLeave2Id = res.body.data.id;
    });
  });

  describe('3. Approval Workflow & Decision History', () => {
    it('should reject approval when remarks are empty', async () => {
      const res = await request(app)
        .post(`/api/v1/leaves/${testLeave1Id}/review`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          action: 'APPROVED',
          remarks: '',
        });
      expect(res.status).toBe(400);
    });

    it('should approve leave and record reviewer decision history', async () => {
      const res = await request(app)
        .post(`/api/v1/leaves/${testLeave1Id}/review`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          action: 'APPROVED',
          remarks: 'Medical certificate verified. Approved for 3 days rest.',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('APPROVED');
      expect(res.body.data.reviewRemarks).toMatch(/Medical certificate verified/);
      expect(res.body.data.latestDecision).toBeDefined();
      expect(res.body.data.latestDecision.action).toBe('APPROVED');
    });

    it('should prevent re-approving an already approved leave', async () => {
      const res = await request(app)
        .post(`/api/v1/leaves/${testLeave1Id}/review`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          action: 'APPROVED',
          remarks: 'Duplicate review attempt',
        });
      expect(res.status).toBe(500);
      expect(res.body.message).toMatch(/Cannot review leave that is already APPROVED/i);
    });

    it('should reject a pending leave application with remarks', async () => {
      const res = await request(app)
        .post(`/api/v1/leaves/${testLeave2Id}/review`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          action: 'REJECTED',
          remarks: 'Insufficient notice provided before scheduled class assessments.',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('REJECTED');
    });
  });

  describe('4. Bulk Review Operations', () => {
    let bulkLeave1;
    let bulkLeave2;

    beforeAll(async () => {
      const r1 = await request(app)
        .post('/api/v1/leaves')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          studentId: sampleStudent1Id,
          leaveType: 'OTHER',
          startDate: '2026-12-01',
          endDate: '2026-12-02',
          reason: 'Sports competition event',
        });
      bulkLeave1 = r1.body.data.id;

      const r2 = await request(app)
        .post('/api/v1/leaves')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          studentId: sampleStudent2Id,
          leaveType: 'EMERGENCY',
          startDate: '2026-12-01',
          endDate: '2026-12-01',
          reason: 'Urgent household repair issue',
        });
      bulkLeave2 = r2.body.data.id;
    });

    it('should bulk approve multiple leave applications', async () => {
      const res = await request(app)
        .post('/api/v1/leaves/bulk-review')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          leaveIds: [bulkLeave1, bulkLeave2],
          action: 'APPROVED',
          remarks: 'Bulk reviewed and approved by school administration.',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.successful.length).toBe(2);
      expect(res.body.data.failed.length).toBe(0);
    });
  });

  describe('5. Attendance Integration with Approved Leave', () => {
    it('should identify student on approved leave via attendance-check endpoint', async () => {
      const res = await request(app)
        .get(`/api/v1/leaves/attendance-check?classId=${sampleClassId}&date=2026-11-17`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      const onLeave = res.body.data.find((l) => l.studentId === sampleStudent1Id);
      expect(onLeave).toBeDefined();
      expect(onLeave.leaveType).toBe('SICK');
    });

    it('should reflect approved leave indicator in getSession attendance roster', async () => {
      // Start or retrieve a session for sampleClassId on 2026-11-17
      const sessionRes = await request(app)
        .post('/api/v1/attendance/sessions/start')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          classId: sampleClassId,
          sessionDate: '2026-11-17',
          notes: 'Leave integration verification session',
        });

      expect([200, 201]).toContain(sessionRes.status);
      const sessionId = sessionRes.body.data.id;

      const detailRes = await request(app)
        .get(`/api/v1/attendance/sessions/${sessionId}`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(detailRes.status).toBe(200);
      const student1Roster = detailRes.body.data.roster.find((r) => r.studentId === sampleStudent1Id);
      expect(student1Roster).toBeDefined();
      expect(student1Roster.isApprovedLeave).toBe(true);
      expect(student1Roster.status).toBe('ON_LEAVE');
      expect(detailRes.body.data.stats.onLeaveCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe('6. Discipline & Student Incident Management', () => {
    it('should record a student incident with category, severity and description', async () => {
      const res = await request(app)
        .post('/api/v1/incidents')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          studentId: sampleStudent1Id,
          classId: sampleClassId,
          title: 'Classroom disturbance during science lab',
          description: 'Refused instructions during lab safety protocols and disrupted group study.',
          category: 'BEHAVIOUR',
          severity: 'MEDIUM',
          actionTaken: 'Verbal warning and seated separately for remainder of class',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('REPORTED');
      expect(res.body.data.category).toBe('BEHAVIOUR');
      expect(res.body.data.severity).toBe('MEDIUM');
      testIncidentId = res.body.data.id;
    });

    it('should list incidents with filtering and pagination', async () => {
      const res = await request(app)
        .get('/api/v1/incidents?category=BEHAVIOUR&severity=MEDIUM')
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.incidents)).toBe(true);
      expect(res.body.data.incidents.length).toBeGreaterThanOrEqual(1);
    });

    it('should update incident status to UNDER_INVESTIGATION and add timeline history', async () => {
      const res = await request(app)
        .patch(`/api/v1/incidents/${testIncidentId}/status`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          status: 'UNDER_INVESTIGATION',
          actionTaken: 'Parent contact scheduled by class teacher',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('UNDER_INVESTIGATION');
    });

    it('should add standalone action history to incident', async () => {
      const res = await request(app)
        .post(`/api/v1/incidents/${testIncidentId}/actions`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          action: 'COUNSELLING',
          notes: 'Met with student counselor. Student acknowledged behavior and agreed to lab standards.',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.action).toBe('COUNSELLING');
    });

    it('should resolve incident with resolution notes', async () => {
      const res = await request(app)
        .patch(`/api/v1/incidents/${testIncidentId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'RESOLVED',
          resolutionNotes: 'Counselling completed and student demonstrated compliance.',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('RESOLVED');
      expect(res.body.data.resolvedAt).toBeDefined();
    });
  });

  describe('7. Reports & CSV Export Operations', () => {
    it('should return aggregated leave summary statistics', async () => {
      const res = await request(app)
        .get('/api/v1/leaves/summary')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.totalApplications).toBeGreaterThanOrEqual(2);
      expect(res.body.data.approvedCount).toBeGreaterThanOrEqual(1);
    });

    it('should return aggregated incident summary statistics', async () => {
      const res = await request(app)
        .get('/api/v1/incidents/summary')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.totalIncidents).toBeGreaterThanOrEqual(1);
      expect(res.body.data.byCategory.BEHAVIOUR).toBeGreaterThanOrEqual(1);
    });

    it('should export leave records as RFC 4180 CSV', async () => {
      const res = await request(app)
        .get('/api/v1/leaves/export')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/text\/csv/);
      expect(res.text).toContain('Leave ID,Student Name,Admission Number');
    });

    it('should export incident records as RFC 4180 CSV', async () => {
      const res = await request(app)
        .get('/api/v1/incidents/export')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/text\/csv/);
      expect(res.text).toContain('Incident ID,Date,Student Name');
    });
  });
});
