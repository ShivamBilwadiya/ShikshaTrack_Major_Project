import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/config/db.js';

describe('Academic Year Financial Archiving & Rollover Management API', () => {
  let adminToken;
  let adminUser;
  let teacherToken;
  let testClass;
  let testStudent;
  let testFeeStructure;
  let testStudentFee;
  let testPayment;
  let foreignSchool;

  const testSourceYear = `2025-${Date.now().toString().slice(-4)}`;
  const testTargetYear = `2026-${Date.now().toString().slice(-4)}`;

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
        name: `Class 6 Rollover ${Date.now()}`,
        section: 'A',
        academicYear: testSourceYear,
        schoolId: adminUser.schoolId,
      },
    });

    // 4. Create test student
    testStudent = await prisma.student.create({
      data: {
        name: 'Financial Rollover Student',
        admissionNumber: `FEE-ROLL-${Date.now()}`,
        classId: testClass.id,
        schoolId: adminUser.schoolId,
        active: true,
      },
    });

    // 5. Create fee structure for testSourceYear
    testFeeStructure = await prisma.feeStructure.create({
      data: {
        schoolId: adminUser.schoolId,
        classId: testClass.id,
        name: `Annual Tuition Fee ${testSourceYear}`,
        academicYear: testSourceYear,
        category: 'TUITION',
        totalAmount: 15000,
        frequency: 'ANNUAL',
      },
    });

    // 6. Create student fee record
    testStudentFee = await prisma.studentFee.create({
      data: {
        schoolId: adminUser.schoolId,
        studentId: testStudent.id,
        feeStructureId: testFeeStructure.id,
        academicYear: testSourceYear,
        originalAmount: 15000,
        netAmount: 15000,
        paidAmount: 10000,
        balanceAmount: 5000,
        status: 'PARTIAL',
      },
    });

    // 7. Create payment transaction
    testPayment = await prisma.feePayment.create({
      data: {
        schoolId: adminUser.schoolId,
        studentFeeId: testStudentFee.id,
        studentId: testStudent.id,
        receiptNumber: `RCPT-ROLL-${Date.now()}`,
        amountPaid: 10000,
        paymentMethod: 'CASH',
        paymentDate: new Date(),
        recordedById: adminUser.id,
      },
    });

    // 8. Create foreign school for isolation tests
    foreignSchool = await prisma.school.create({
      data: {
        name: `Isolated Rollover School ${Date.now()}`,
        code: `RISO-${Date.now().toString().slice(-4)}`,
        address: 'Out of region',
      },
    });
  });

  afterAll(async () => {
    try {
      if (testPayment) {
        await prisma.feePayment.deleteMany({ where: { studentFeeId: testStudentFee?.id } });
      }
      if (testStudentFee) {
        await prisma.studentFee.deleteMany({ where: { id: testStudentFee.id } });
      }
      if (testFeeStructure) {
        await prisma.feeStructure.deleteMany({
          where: {
            OR: [
              { id: testFeeStructure.id },
              { schoolId: adminUser.schoolId, academicYear: testTargetYear },
            ],
          },
        });
      }
      if (testStudent) {
        await prisma.student.deleteMany({ where: { id: testStudent.id } });
      }
      if (testClass) {
        await prisma.class.deleteMany({ where: { id: testClass.id } });
      }
      await prisma.financialYearArchive.deleteMany({
        where: { schoolId: adminUser.schoolId, academicYear: testSourceYear },
      });
      await prisma.auditLog.deleteMany({
        where: {
          action: { in: ['FINANCIAL_YEAR_ARCHIVED', 'FEE_STRUCTURES_ROLLED_OVER'] },
        },
      });
      if (foreignSchool) {
        await prisma.school.deleteMany({ where: { id: foreignSchool.id } });
      }
    } catch (e) {
      // Best effort cleanup
    }
  });

  describe('Authorization & Access Control', () => {
    it('should reject unauthenticated request with 401', async () => {
      const res = await request(app).get(`/api/v1/fees/rollover/overview?academicYear=${testSourceYear}`);
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should reject non-admin (TEACHER) request with 403 Forbidden', async () => {
      const res = await request(app)
        .get(`/api/v1/fees/rollover/overview?academicYear=${testSourceYear}`)
        .set('Authorization', `Bearer ${teacherToken}`);
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });

  describe('Financial Overview & Rollover Preview', () => {
    it('should calculate financial year totals accurately', async () => {
      const res = await request(app)
        .get(`/api/v1/fees/rollover/overview?academicYear=${testSourceYear}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.academicYear).toBe(testSourceYear);
      expect(res.body.data.metrics.totalAssessed).toBe(15000);
      expect(res.body.data.metrics.totalCollected).toBe(10000);
      expect(res.body.data.metrics.totalPending).toBe(5000);
      expect(res.body.data.isArchived).toBe(false);
      expect(res.body.data.studentsWithDues.length).toBeGreaterThanOrEqual(1);
    });

    it('should preview rollover and detect students with outstanding dues', async () => {
      const res = await request(app)
        .post('/api/v1/fees/rollover/preview')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          sourceYear: testSourceYear,
          targetYear: testTargetYear,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.sourceYear).toBe(testSourceYear);
      expect(res.body.data.targetYear).toBe(testTargetYear);
      expect(res.body.data.proposedCopies.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.validationWarnings.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Financial Archiving & Duplicate Prevention', () => {
    it('should successfully archive the financial year and record AuditLog', async () => {
      const res = await request(app)
        .post('/api/v1/fees/rollover/archive')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          academicYear: testSourceYear,
          notes: 'Year-end financial audit completed and ledger sealed',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.academicYear).toBe(testSourceYear);
      expect(res.body.data.totalAssessed).toBe(15000);
      expect(res.body.data.totalCollected).toBe(10000);
      expect(res.body.data.totalPending).toBe(5000);

      // Verify AuditLog entry exists
      const log = await prisma.auditLog.findFirst({
        where: {
          action: 'FINANCIAL_YEAR_ARCHIVED',
          entityId: res.body.data.id,
        },
      });
      expect(log).toBeDefined();
      expect(log.actorId).toBe(adminUser.id);
    });

    it('should prevent duplicate archival of the same academic year', async () => {
      const res = await request(app)
        .post('/api/v1/fees/rollover/archive')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          academicYear: testSourceYear,
          notes: 'Attempting duplicate archive',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('already been archived');
    });
  });

  describe('Fee Structure Rollover & Historical Record Preservation', () => {
    it('should clone fee structures to target year without charging students', async () => {
      const res = await request(app)
        .post('/api/v1/fees/rollover/copy-structures')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          sourceYear: testSourceYear,
          targetYear: testTargetYear,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.copiedCount).toBeGreaterThanOrEqual(1);

      // Verify fee structures in target year exist
      const clonedStructures = await prisma.feeStructure.findMany({
        where: { schoolId: adminUser.schoolId, academicYear: testTargetYear },
      });
      expect(clonedStructures.length).toBeGreaterThanOrEqual(1);

      // Verify NO student fees were created automatically for target year
      const targetStudentFees = await prisma.studentFee.findMany({
        where: { schoolId: adminUser.schoolId, academicYear: testTargetYear },
      });
      expect(targetStudentFees.length).toBe(0);
    });

    it('should preserve historical payments and student fee ledgers intact', async () => {
      // Historical payment must still exist unchanged
      const payment = await prisma.feePayment.findUnique({
        where: { id: testPayment.id },
      });
      expect(payment).toBeDefined();
      expect(payment.amountPaid).toBe(10000);
      expect(payment.isReversed).toBe(false);

      // Historical student fee must retain historical balance
      const studentFee = await prisma.studentFee.findUnique({
        where: { id: testStudentFee.id },
      });
      expect(studentFee).toBeDefined();
      expect(studentFee.balanceAmount).toBe(5000);
      expect(studentFee.academicYear).toBe(testSourceYear);
    });

    it('should reject rollover if destination year is identical to source year', async () => {
      const res = await request(app)
        .post('/api/v1/fees/rollover/copy-structures')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          sourceYear: testSourceYear,
          targetYear: testSourceYear,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('must be distinct');
    });
  });
});
