import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/config/db.js';

describe('Examination, Assessment & Result Management API', () => {
  let adminToken;
  let teacherToken;
  let sampleClassId;
  let sampleStudent1Id;
  let sampleStudent2Id;
  let createdExamId;
  let mathSubjectId;
  let sciSubjectId;

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

    // Fetch an active student and their assigned class
    const student1 = await prisma.student.findFirst({ where: { active: true } });
    sampleClassId = student1.classId;
    const students = await prisma.student.findMany({
      where: { classId: sampleClassId, active: true },
      take: 2,
    });
    sampleStudent1Id = students[0].id;
    sampleStudent2Id = students.length > 1 ? students[1].id : students[0].id;

    // Clean up past test exams
    await prisma.examination.deleteMany({});
  });

  afterAll(async () => {
    await prisma.examination.deleteMany({});
  });

  describe('Authentication & Access Control', () => {
    it('should reject unauthenticated request with 401', async () => {
      const res = await request(app).get('/api/v1/exams');
      expect(res.status).toBe(401);
    });

    it('should reject non-admin (TEACHER) exam creation with 403', async () => {
      const res = await request(app)
        .post('/api/v1/exams')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          name: 'Midterm 2026',
          academicYear: '2026-2027',
          startDate: '2026-09-01',
          endDate: '2026-09-10',
        });
      expect(res.status).toBe(403);
    });

    it('should allow TEACHER to read exams list', async () => {
      const res = await request(app)
        .get('/api/v1/exams')
        .set('Authorization', `Bearer ${teacherToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('Validation & Exam Creation', () => {
    it('should reject exam creation with missing required fields', async () => {
      const res = await request(app)
        .post('/api/v1/exams')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          academicYear: '2026-2027',
        });
      expect(res.status).toBe(400);
      expect(res.body.message).toContain('name is required');
    });

    it('should reject invalid examType', async () => {
      const res = await request(app)
        .post('/api/v1/exams')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Midterm Assessment',
          academicYear: '2026-2027',
          examType: 'POP_QUIZ',
          startDate: '2026-09-01',
          endDate: '2026-09-10',
        });
      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Invalid examType');
    });

    it('should reject start date after end date', async () => {
      const res = await request(app)
        .post('/api/v1/exams')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Midterm Assessment',
          academicYear: '2026-2027',
          startDate: '2026-09-15',
          endDate: '2026-09-10',
        });
      expect(res.status).toBe(400);
      expect(res.body.message).toContain('start date cannot be after end date');
    });

    it('should allow ADMIN to create examination with initial subjects', async () => {
      const res = await request(app)
        .post('/api/v1/exams')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Term 1 Midterm Assessment',
          examType: 'MIDTERM',
          academicYear: '2026-2027',
          classId: sampleClassId,
          startDate: '2026-09-01',
          endDate: '2026-09-10',
          subjects: [
            { subject: 'Mathematics', maxMarks: 100, passMarks: 33 },
            { subject: 'Science', maxMarks: 100, passMarks: 33 },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.examSubjects.length).toBe(2);
      createdExamId = res.body.data.id;
      mathSubjectId = res.body.data.examSubjects[0].id;
      sciSubjectId = res.body.data.examSubjects[1].id;
    });

    it('should reject duplicate examination in same academic cycle (409)', async () => {
      const res = await request(app)
        .post('/api/v1/exams')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Term 1 Midterm Assessment',
          academicYear: '2026-2027',
          classId: sampleClassId,
          startDate: '2026-09-01',
          endDate: '2026-09-10',
        });
      expect(res.status).toBe(409);
    });
  });

  describe('Subject Configuration & Marks Recording', () => {
    it('should allow adding an additional subject paper', async () => {
      const res = await request(app)
        .post(`/api/v1/exams/${createdExamId}/subjects`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          subject: 'English',
          maxMarks: 100,
          passMarks: 33,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.subject).toBe('English');
    });

    it('should reject duplicate subject assignment in the same exam', async () => {
      const res = await request(app)
        .post(`/api/v1/exams/${createdExamId}/subjects`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          subject: 'English',
          maxMarks: 100,
          passMarks: 33,
        });

      expect(res.status).toBe(409);
      expect(res.body.message).toContain('already assigned');
    });

    it('should reject marks exceeding maximum marks (boundary validation)', async () => {
      const res = await request(app)
        .post(`/api/v1/exams/subjects/${mathSubjectId}/marks`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          marks: [{ studentId: sampleStudent1Id, marksObtained: 105 }],
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Must be between 0 and 100');
    });

    it('should reject negative marks', async () => {
      const res = await request(app)
        .post(`/api/v1/exams/subjects/${mathSubjectId}/marks`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          marks: [{ studentId: sampleStudent1Id, marksObtained: -5 }],
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Must be between 0 and 100');
    });

    it('should allow recording bulk marks for subject paper', async () => {
      const res = await request(app)
        .post(`/api/v1/exams/subjects/${mathSubjectId}/marks`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          marks: [
            { studentId: sampleStudent1Id, marksObtained: 92, remarks: 'Excellent' },
            { studentId: sampleStudent2Id, marksObtained: 28, remarks: 'Needs help' },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.recordedCount).toBe(2);

      // Also record Science marks
      await request(app)
        .post(`/api/v1/exams/subjects/${sciSubjectId}/marks`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          marks: [
            { studentId: sampleStudent1Id, marksObtained: 88 },
            { studentId: sampleStudent2Id, marksObtained: 45 },
          ],
        });
    });
  });

  describe('Result Aggregation, Grading & CSV Export', () => {
    it('should calculate class exam results with percentage, grade, and pass/fail', async () => {
      const res = await request(app)
        .get(`/api/v1/exams/${createdExamId}/results?classId=${sampleClassId}`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.summary).toBeDefined();
      expect(res.body.data.results.length).toBeGreaterThanOrEqual(2);

      // Student 1 (High scorer: 92 in Math, 88 in Science)
      const s1 = res.body.data.results.find((r) => r.studentId === sampleStudent1Id);
      expect(s1).toBeDefined();
      expect(s1.totalObtained).toBe(180);
      expect(s1.status).toBe('FAIL'); // Because English had no mark recorded yet!

      // Update English for Student 1 to 90
      const engSub = (await prisma.examSubject.findFirst({ where: { examinationId: createdExamId, subject: 'English' } }));
      await request(app)
        .post(`/api/v1/exams/subjects/${engSub.id}/marks`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          marks: [{ studentId: sampleStudent1Id, marksObtained: 90 }],
        });

      // Re-fetch results
      const res2 = await request(app)
        .get(`/api/v1/exams/${createdExamId}/results?classId=${sampleClassId}`)
        .set('Authorization', `Bearer ${teacherToken}`);

      const s1Updated = res2.body.data.results.find((r) => r.studentId === sampleStudent1Id);
      expect(s1Updated.totalObtained).toBe(270);
      expect(s1Updated.totalMaxMarks).toBe(300);
      expect(s1Updated.percentage).toBe(90);
      expect(s1Updated.grade).toBe('A+');
      expect(s1Updated.status).toBe('PASS');

      // Student 2 failed Math with 28 (< 33 pass mark)
      const s2 = res2.body.data.results.find((r) => r.studentId === sampleStudent2Id);
      expect(s2.status).toBe('FAIL');
    });

    it('should export class exam results as standard CSV', async () => {
      const res = await request(app)
        .get(`/api/v1/exams/${createdExamId}/results/export?classId=${sampleClassId}`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.text).toContain('Roll Number');
      expect(res.text).toContain('Student Name');
      expect(res.text).toContain('Mathematics');
      expect(res.text).toContain('Percentage (%)');
      expect(res.text).toContain('Grade');
      expect(res.text).toContain('PASS');
    });
  });

  describe('Update & Deletion Lifecycle', () => {
    it('should allow ADMIN to update examination metadata', async () => {
      const res = await request(app)
        .put(`/api/v1/exams/${createdExamId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Term 1 Midterm Assessment (Revised)',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Term 1 Midterm Assessment (Revised)');
    });

    it('should allow ADMIN to delete examination and cascade marks', async () => {
      const res = await request(app)
        .delete(`/api/v1/exams/${createdExamId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);

      // Verify 404
      const checkRes = await request(app)
        .get(`/api/v1/exams/${createdExamId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(checkRes.status).toBe(404);
    });
  });
});
