import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/config/db.js';

describe('Transfer Certificate & Student Exit Management API', () => {
  let adminToken;
  let adminUser;
  let teacherToken;
  let testClass;
  let testStudentWithDues;
  let testStudentCleared;
  let foreignStudent;
  let testFeeStructure;
  let createdCertificateId;

  beforeAll(async () => {
    // 1. Admin login
    const adminRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@shikshatrack.in', password: 'admin123' });
    expect(adminRes.status).toBe(200);
    adminToken = adminRes.body.data.token;
    adminUser = adminRes.body.data.user;

    // 2. Teacher login
    const teacherRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'ramesh.teacher@shikshatrack.in', password: 'teacher123' });
    expect(teacherRes.status).toBe(200);
    teacherToken = teacherRes.body.data.token;

    // 3. Create test class
    testClass = await prisma.class.create({
      data: {
        name: `Class 10 Exit ${Date.now()}`,
        section: 'A',
        academicYear: '2026-2027',
        schoolId: adminUser.schoolId,
      },
    });

    // 4. Create test student 1 (with fee dues)
    testStudentWithDues = await prisma.student.create({
      data: {
        name: 'Exit Student With Dues',
        admissionNumber: `TC-DUE-${Date.now()}`,
        classId: testClass.id,
        schoolId: adminUser.schoolId,
        active: true,
      },
    });

    // Create fee structure and outstanding fee for student 1
    testFeeStructure = await prisma.feeStructure.create({
      data: {
        schoolId: adminUser.schoolId,
        classId: testClass.id,
        name: 'Annual Tuition Fee',
        academicYear: '2026-2027',
        totalAmount: 12000,
      },
    });

    await prisma.studentFee.create({
      data: {
        schoolId: adminUser.schoolId,
        studentId: testStudentWithDues.id,
        feeStructureId: testFeeStructure.id,
        academicYear: '2026-2027',
        originalAmount: 12000,
        netAmount: 12000,
        paidAmount: 2000,
        balanceAmount: 10000,
        status: 'PARTIAL',
      },
    });

    // 5. Create test student 2 (cleared fees)
    testStudentCleared = await prisma.student.create({
      data: {
        name: 'Exit Student Cleared',
        admissionNumber: `TC-CLR-${Date.now()}`,
        classId: testClass.id,
        schoolId: adminUser.schoolId,
        active: true,
      },
    });

    // 6. Create student in another school for tenant isolation
    const otherSchool = await prisma.school.create({
      data: {
        name: `Isolated Foreign School ${Date.now()}`,
        code: `FGN-${Date.now().toString().slice(-4)}`,
        address: 'Foreign district',
      },
    });

    const otherClass = await prisma.class.create({
      data: {
        name: 'Foreign Class 10',
        section: 'B',
        academicYear: '2026-2027',
        schoolId: otherSchool.id,
      },
    });

    foreignStudent = await prisma.student.create({
      data: {
        name: 'Foreign Student',
        admissionNumber: `FGN-${Date.now()}`,
        classId: otherClass.id,
        schoolId: otherSchool.id,
        active: true,
      },
    });
  });

  afterAll(async () => {
    try {
      if (testStudentWithDues || testStudentCleared) {
        await prisma.auditLog.deleteMany({
          where: {
            entityId: { in: [testStudentWithDues?.id, testStudentCleared?.id].filter(Boolean) },
          },
        });
        await prisma.issuedCertificate.deleteMany({
          where: {
            studentId: { in: [testStudentWithDues?.id, testStudentCleared?.id].filter(Boolean) },
          },
        });
        await prisma.studentFee.deleteMany({
          where: { studentId: testStudentWithDues.id },
        });
        await prisma.feeStructure.deleteMany({
          where: { id: testFeeStructure.id },
        });
        await prisma.student.deleteMany({
          where: {
            id: { in: [testStudentWithDues?.id, testStudentCleared?.id].filter(Boolean) },
          },
        });
      }
      if (testClass) await prisma.class.deleteMany({ where: { id: testClass.id } });
      if (foreignStudent) {
        await prisma.student.deleteMany({ where: { id: foreignStudent.id } });
        await prisma.class.deleteMany({ where: { id: foreignStudent.classId } });
        await prisma.school.deleteMany({ where: { id: foreignStudent.schoolId } });
      }
    } catch (e) {
      // Best effort cleanup
    }
  });

  describe('Authorization & Tenant Isolation', () => {
    it('should reject unauthenticated request with 401', async () => {
      const res = await request(app).get(`/api/v1/students/tc/preview/${testStudentCleared.id}`);
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should reject non-admin (TEACHER) request with 403 Forbidden', async () => {
      const res = await request(app)
        .get(`/api/v1/students/tc/preview/${testStudentCleared.id}`)
        .set('Authorization', `Bearer ${teacherToken}`);
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('should enforce school isolation and reject accessing foreign student', async () => {
      const res = await request(app)
        .get(`/api/v1/students/tc/preview/${foreignStudent.id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Student not found in this institution');
    });
  });

  describe('Fee Clearance Validation', () => {
    it('should detect outstanding fee balance during preview', async () => {
      const res = await request(app)
        .get(`/api/v1/students/tc/preview/${testStudentWithDues.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.feeStatus.isCleared).toBe(false);
      expect(res.body.data.feeStatus.totalBalance).toBe(10000);
    });

    it('should block TC issuance when fees are pending without explicit waiver', async () => {
      const res = await request(app)
        .post('/api/v1/students/tc/issue')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          studentId: testStudentWithDues.id,
          exitReason: 'Relocation to another district',
          allowWithPendingFees: false,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('outstanding fee balance of ₹10000');
    });
  });

  describe('Certificate Generation & Student Exit Lifecycle', () => {
    it('should issue Transfer Certificate, deactivate student, and audit the action', async () => {
      const res = await request(app)
        .post('/api/v1/students/tc/issue')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          studentId: testStudentCleared.id,
          exitReason: 'Completed secondary schooling',
          conduct: 'Exemplary',
          remarks: 'Good academic performance in mathematics and sciences.',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.type).toBe('TRANSFER');
      expect(res.body.data.certificateNumber).toContain('TC-');
      createdCertificateId = res.body.data.id;

      // Verify student active status is set to false (exited)
      const student = await prisma.student.findUnique({
        where: { id: testStudentCleared.id },
      });
      expect(student.active).toBe(false);

      // Verify AuditLog record
      const audit = await prisma.auditLog.findFirst({
        where: {
          entityId: testStudentCleared.id,
          action: 'STUDENT_EXIT_TC_ISSUED',
        },
      });
      expect(audit).toBeDefined();
      expect(audit.actorId).toBe(adminUser.id);
      expect(audit.reason).toContain('Transfer Certificate');
    });

    it('should prevent duplicate Transfer Certificate issuance for the same exited student', async () => {
      const res = await request(app)
        .post('/api/v1/students/tc/issue')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          studentId: testStudentCleared.id,
          exitReason: 'Duplicate attempt test',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Duplicate issuance is prohibited');
    });

    it('should generate printable vector PDF for the issued Transfer Certificate', async () => {
      const res = await request(app)
        .get(`/api/v1/students/tc/download/${createdCertificateId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/pdf');
      expect(res.headers['content-disposition']).toContain('attachment');
      expect(res.body.length).toBeGreaterThan(500);
    });
  });
});
