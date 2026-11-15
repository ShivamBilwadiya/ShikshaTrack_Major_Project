import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/config/db.js';
import bcrypt from 'bcryptjs';

describe('Student Performance & Early Intervention Intelligence System', () => {
  let adminToken;
  let teacherToken;
  let teacherUserId;
  let parentToken;
  let parentUserId;
  let sampleClassId;
  let sampleStudent1;
  let sampleStudent2;
  let testExamId;
  let testSubjectMathId;
  let testSubjectScienceId;
  let createdInterventionId;
  let testSessionIds = [];

  const testParentEmail = `parent.perf.${Date.now()}@shikshatrack.in`;
  const testParentPassword = 'ParentPassword123!';

  beforeAll(async () => {
    // 1. Admin login
    const adminRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@shikshatrack.in', password: 'admin123' });
    expect(adminRes.status).toBe(200);
    adminToken = adminRes.body.data.token;
    const adminSchoolId = adminRes.body.data.user.schoolId;

    // 2. Teacher login
    const teacherRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'ramesh.teacher@shikshatrack.in', password: 'teacher123' });
    expect(teacherRes.status).toBe(200);
    teacherToken = teacherRes.body.data.token;
    teacherUserId = teacherRes.body.data.user.id;

    // 3. Resolve active students and class
    const students = await prisma.student.findMany({
      where: { active: true, schoolId: adminSchoolId },
      take: 2,
      include: { class: true },
    });
    expect(students.length).toBeGreaterThanOrEqual(2);
    sampleStudent1 = students[0];
    sampleStudent2 = students[1];
    sampleClassId = sampleStudent1.classId;

    // 4. Create a test parent linked only to sampleStudent1
    const hashedPassword = await bcrypt.hash(testParentPassword, 10);
    const parentUser = await prisma.user.create({
      data: {
        name: 'Performance Test Parent',
        email: testParentEmail,
        passwordHash: hashedPassword,
        role: 'PARENT',
        schoolId: adminSchoolId,
      },
    });
    parentUserId = parentUser.id;

    const parentProfile = await prisma.parent.create({
      data: {
        userId: parentUser.id,
        schoolId: adminSchoolId,
        guardianName: 'Performance Test Parent',
        relationship: 'FATHER',
        phone: '9876543210',
      },
    });

    await prisma.parentStudent.create({
      data: {
        parentId: parentProfile.id,
        studentId: sampleStudent1.id,
        relationship: 'FATHER',
        isPrimaryContact: true,
      },
    });

    const parentLoginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: testParentEmail, password: testParentPassword });
    expect(parentLoginRes.status).toBe(200);
    parentToken = parentLoginRes.body.data.token;

    // 5. Create a test examination, subjects, and marks for performance analytics
    const exam = await prisma.examination.create({
      data: {
        schoolId: adminSchoolId,
        classId: sampleClassId,
        name: `Performance Evaluation Exam ${Date.now()}`,
        academicYear: '2026-2027',
        examType: 'FINAL',
        startDate: new Date('2026-03-01'),
        endDate: new Date('2026-03-10'),
      },
    });
    testExamId = exam.id;

    const mathSubject = await prisma.examSubject.create({
      data: {
        examinationId: exam.id,
        subject: 'Mathematics',
        maxMarks: 100,
        passMarks: 40,
        examDate: new Date('2026-03-02'),
      },
    });
    testSubjectMathId = mathSubject.id;

    const scienceSubject = await prisma.examSubject.create({
      data: {
        examinationId: exam.id,
        subject: 'Science',
        maxMarks: 100,
        passMarks: 40,
        examDate: new Date('2026-03-04'),
      },
    });
    testSubjectScienceId = scienceSubject.id;

    // High performing marks for student 1
    await prisma.examMark.createMany({
      data: [
        {
          examSubjectId: mathSubject.id,
          studentId: sampleStudent1.id,
          marksObtained: 88,
          remarks: 'Excellent analytical skills',
        },
        {
          examSubjectId: scienceSubject.id,
          studentId: sampleStudent1.id,
          marksObtained: 92,
          remarks: 'Outstanding conceptual grasp',
        },
        // Low/Failing marks for student 2 (at-risk triggers)
        {
          examSubjectId: mathSubject.id,
          studentId: sampleStudent2.id,
          marksObtained: 28,
          remarks: 'Needs basic algebra review',
        },
        {
          examSubjectId: scienceSubject.id,
          studentId: sampleStudent2.id,
          marksObtained: 34,
          remarks: 'Struggling with assignments',
        },
      ],
    });

    // Create attendance sessions & records: student 1 high attendance, student 2 low attendance
    const today = new Date();
    for (let i = 0; i < 5; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);

      const session = await prisma.attendanceSession.create({
        data: {
          classId: sampleClassId,
          teacherId: teacherUserId,
          sessionDate: date,
          status: 'CLOSED',
          notes: `Test attendance session day ${i + 1}`,
        },
      });
      testSessionIds.push(session.id);

      await prisma.attendanceRecord.create({
        data: {
          sessionId: session.id,
          studentId: sampleStudent1.id,
          status: 'PRESENT',
        },
      });

      await prisma.attendanceRecord.create({
        data: {
          sessionId: session.id,
          studentId: sampleStudent2.id,
          status: i === 0 ? 'PRESENT' : 'ABSENT',
        },
      });
    }
  });

  afterAll(async () => {
    // Clean up created entities
    try {
      if (testExamId) {
        await prisma.academicInterventionNote.deleteMany({});
        await prisma.academicIntervention.deleteMany({});
        await prisma.examMark.deleteMany({
          where: { examSubjectId: { in: [testSubjectMathId, testSubjectScienceId] } },
        });
        await prisma.examSubject.deleteMany({ where: { examinationId: testExamId } });
        await prisma.examination.deleteMany({ where: { id: testExamId } });
      }

      if (testSessionIds.length > 0) {
        await prisma.attendanceRecord.deleteMany({
          where: { sessionId: { in: testSessionIds } },
        });
        await prisma.attendanceSession.deleteMany({
          where: { id: { in: testSessionIds } },
        });
      }

      if (parentUserId) {
        await prisma.parentStudent.deleteMany({ where: { studentId: sampleStudent1.id } });
        await prisma.parent.deleteMany({ where: { userId: parentUserId } });
        await prisma.user.deleteMany({ where: { id: parentUserId } });
      }
    } catch (err) {
      // Best effort cleanup
    }
  });

  describe('Authentication & Access Control', () => {
    it('should reject unauthenticated requests with 401', async () => {
      const res = await request(app).get('/api/v1/performance/overview');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should reject unauthorized role (PARENT) accessing administrative overview with 403', async () => {
      const res = await request(app)
        .get('/api/v1/performance/overview')
        .set('Authorization', `Bearer ${parentToken}`);
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('should allow TEACHER and ADMIN to access performance overview', async () => {
      const teacherRes = await request(app)
        .get('/api/v1/performance/overview')
        .set('Authorization', `Bearer ${teacherToken}`);
      expect(teacherRes.status).toBe(200);
      expect(teacherRes.body.success).toBe(true);

      const adminRes = await request(app)
        .get('/api/v1/performance/overview')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(adminRes.status).toBe(200);
      expect(adminRes.body.success).toBe(true);
    });
  });

  describe('Academic Performance Summaries & Overview', () => {
    it('should compute overview KPI statistics accurately', async () => {
      const res = await request(app)
        .get('/api/v1/performance/overview')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const data = res.body.data;
      expect(data).toHaveProperty('totalStudentsEvaluated');
      expect(data).toHaveProperty('totalEvaluations');
      expect(data).toHaveProperty('averagePercentage');
      expect(data).toHaveProperty('overallPassRate');
      expect(data).toHaveProperty('atRiskCount');
      expect(data).toHaveProperty('gradeDistribution');
      expect(typeof data.averagePercentage).toBe('number');
      expect(data.totalStudentsEvaluated).toBeGreaterThanOrEqual(1);
    });

    it('should filter overview by classId correctly', async () => {
      const res = await request(app)
        .get(`/api/v1/performance/overview?classId=${sampleClassId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalStudentsEvaluated).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Subject-wise Performance & Grade Analysis', () => {
    it('should return subject breakdown with average score and pass rate', async () => {
      const res = await request(app)
        .get('/api/v1/performance/subjects')
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);

      const math = res.body.data.find((s) => s.subject === 'Mathematics');
      expect(math).toBeDefined();
      expect(math.totalEvaluated).toBeGreaterThanOrEqual(2);
      expect(typeof math.averageMarks).toBe('number');
      expect(typeof math.passRate).toBe('number');
      expect(math).toHaveProperty('highestMarks');
      expect(math).toHaveProperty('lowestMarks');
    });

    it('should filter subject analytics by examinationId', async () => {
      const res = await request(app)
        .get(`/api/v1/performance/subjects?examinationId=${testExamId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Examination-to-Examination Trends & Class Comparisons', () => {
    it('should return chronological examination trends', async () => {
      const res = await request(app)
        .get('/api/v1/performance/trends')
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);

      const targetExam = res.body.data.find((e) => e.examinationId === testExamId);
      expect(targetExam).toBeDefined();
      expect(targetExam).toHaveProperty('averagePercentage');
      expect(targetExam).toHaveProperty('evaluatedStudents');
      expect(targetExam).toHaveProperty('trajectory');
    });

    it('should compare performance across classes', async () => {
      const res = await request(app)
        .get('/api/v1/performance/classes')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);

      const targetClass = res.body.data.find((c) => c.classId === sampleClassId);
      expect(targetClass).toBeDefined();
      expect(targetClass).toHaveProperty('averagePercentage');
      expect(targetClass).toHaveProperty('passRate');
    });
  });

  describe('At-Risk Student Identification & Configurable Thresholds', () => {
    it('should identify students with failing grades and low attendance as at-risk', async () => {
      const res = await request(app)
        .get('/api/v1/performance/at-risk?thresholdPercentage=50&attendanceThreshold=75')
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.students)).toBe(true);

      const atRiskStudent = res.body.data.students.find((s) => s.studentId === sampleStudent2.id);
      expect(atRiskStudent).toBeDefined();
      expect(atRiskStudent.failedSubjects.length).toBeGreaterThanOrEqual(1);
      expect(atRiskStudent.riskLevel).toBe('CRITICAL');
      expect(atRiskStudent.suggestedIntervention).toBeDefined();
    });

    it('should allow customizing score and attendance thresholds', async () => {
      const res = await request(app)
        .get('/api/v1/performance/at-risk?thresholdPercentage=20&attendanceThreshold=10')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.students)).toBe(true);
    });
  });

  describe('Attendance and Academic Performance Correlation', () => {
    it('should compute Pearson correlation between attendance rates and academic marks', async () => {
      const res = await request(app)
        .get('/api/v1/performance/correlation')
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const data = res.body.data;
      expect(data).toHaveProperty('pearsonCorrelation');
      expect(data).toHaveProperty('relationshipDescription');
      expect(data).toHaveProperty('totalSamples');
      expect(data).toHaveProperty('scatterPlot');
      expect(typeof data.pearsonCorrelation).toBe('number');
      expect(Array.isArray(data.scatterPlot)).toBe(true);
      expect(data.totalSamples).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Individual Student Diagnostic Drilldown & Parent Security Isolation', () => {
    it('should allow teacher and admin to inspect any student performance drilldown', async () => {
      const res = await request(app)
        .get(`/api/v1/performance/students/${sampleStudent1.id}`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const data = res.body.data;
      expect(data.student.id).toBe(sampleStudent1.id);
      expect(data.student.name).toBe(sampleStudent1.name);
      expect(data).toHaveProperty('performance');
      expect(data.performance.cumulativePercentage).toBeGreaterThanOrEqual(80);
      expect(Array.isArray(data.performance.examinationHistory)).toBe(true);
      expect(data).toHaveProperty('attendance');
    });

    it('should allow PARENT to view diagnostic drilldown for their linked child', async () => {
      const res = await request(app)
        .get(`/api/v1/performance/students/${sampleStudent1.id}`)
        .set('Authorization', `Bearer ${parentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.student.id).toBe(sampleStudent1.id);
    });

    it('should reject PARENT accessing an unlinked child with 403 Forbidden', async () => {
      const res = await request(app)
        .get(`/api/v1/performance/students/${sampleStudent2.id}`)
        .set('Authorization', `Bearer ${parentToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Unauthorized: You can only view performance data for your linked children');
    });
  });

  describe('Early Academic Intervention Workflow', () => {
    it('should validate required fields when creating an intervention', async () => {
      const res = await request(app)
        .post('/api/v1/performance/interventions')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          studentId: sampleStudent2.id,
          // Missing title & description
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('intervention title, and description are required');
    });

    it('should create an academic intervention successfully', async () => {
      const res = await request(app)
        .post('/api/v1/performance/interventions')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          studentId: sampleStudent2.id,
          type: 'ACADEMIC_DEFICIT',
          severity: 'HIGH',
          title: 'Urgent Remedial Coaching for Math & Science',
          description: 'Consistently failing Mathematics and Science with low attendance',
          actionPlan: 'Assign bi-weekly peer tutoring and daily homework checking',
          followUpDate: '2026-04-15',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.studentId).toBe(sampleStudent2.id);
      expect(res.body.data.status).toBe('OPEN');
      expect(res.body.data.severity).toBe('HIGH');
      createdInterventionId = res.body.data.id;
    });

    it('should list interventions with filtering and pagination', async () => {
      const res = await request(app)
        .get('/api/v1/performance/interventions?status=OPEN')
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.interventions)).toBe(true);
      const found = res.body.data.interventions.find((i) => i.id === createdInterventionId);
      expect(found).toBeDefined();
      expect(found.student.name).toBe(sampleStudent2.name);
    });

    it('should update intervention action plan and status', async () => {
      const res = await request(app)
        .put(`/api/v1/performance/interventions/${createdInterventionId}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          status: 'IN_PROGRESS',
          actionPlan: 'Tutoring initiated with Mrs. Sharma; weekly progress tracker active',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('IN_PROGRESS');
      expect(res.body.data.actionPlan).toContain('Tutoring initiated');
    });

    it('should append a progress note to an intervention', async () => {
      const res = await request(app)
        .post(`/api/v1/performance/interventions/${createdInterventionId}/notes`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          note: 'Student attended 3 remedial math sessions this week and completed assignments.',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.interventionId).toBe(createdInterventionId);
      expect(res.body.data.note).toContain('remedial math sessions');
    });

    it('should resolve an intervention with resolution notes', async () => {
      const res = await request(app)
        .post(`/api/v1/performance/interventions/${createdInterventionId}/resolve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          resolutionNotes: 'Student achieved 68% in the follow-up math evaluation. Target reached.',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('RESOLVED');
      expect(res.body.data.resolutionNotes).toContain('Student achieved 68%');
    });
  });

  describe('Report Generation & CSV Export', () => {
    it('should export formatted performance analytics as CSV', async () => {
      const res = await request(app)
        .get('/api/v1/performance/export')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.headers['content-disposition']).toContain('attachment');
      expect(res.text).toContain('Student Name');
      expect(res.text).toContain('Academic Percentage (%)');
      expect(res.text).toContain('Attendance Rate (%)');
      expect(res.text).toContain('Academic Status');
      expect(res.text).toContain(sampleStudent1.name);
      expect(res.text).toContain(sampleStudent2.name);
    });
  });
});
