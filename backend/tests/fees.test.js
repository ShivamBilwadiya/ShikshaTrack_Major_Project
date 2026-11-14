import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/config/db.js';

describe('School Fee Management, Billing & Financial Reporting Subsystem', () => {
  let adminToken;
  let teacherToken;
  let sampleClassId;
  let sampleStudentId;
  let createdStructureId;
  let assignedStudentFeeId;
  let recordedPaymentId;
  let generatedReceiptNumber;

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

    // 3. Resolve active student and class
    const student = await prisma.student.findFirst({ where: { active: true } });
    sampleStudentId = student.id;
    sampleClassId = student.classId;

    // Clean up any test fee records
    await prisma.paymentReversal.deleteMany({});
    await prisma.paymentAllocation.deleteMany({});
    await prisma.feePayment.deleteMany({});
    await prisma.feeDiscount.deleteMany({});
    await prisma.feeInstallment.deleteMany({});
    await prisma.studentFee.deleteMany({});
    await prisma.feeStructure.deleteMany({});
  });

  afterAll(async () => {
    await prisma.paymentReversal.deleteMany({});
    await prisma.paymentAllocation.deleteMany({});
    await prisma.feePayment.deleteMany({});
    await prisma.feeDiscount.deleteMany({});
    await prisma.feeInstallment.deleteMany({});
    await prisma.studentFee.deleteMany({});
    await prisma.feeStructure.deleteMany({});
  });

  describe('1. Security & RBAC Access Control', () => {
    it('should reject unauthenticated request with 401', async () => {
      const res = await request(app).get('/api/v1/fees/structures');
      expect(res.status).toBe(401);
    });

    it('should reject non-admin (TEACHER) from creating fee structure with 403', async () => {
      const res = await request(app)
        .post('/api/v1/fees/structures')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          name: 'Unauthorized Fee',
          academicYear: '2026-2027',
          totalAmount: 5000,
        });
      expect(res.status).toBe(403);
    });

    it('should allow TEACHER to read fee structures', async () => {
      const res = await request(app)
        .get('/api/v1/fees/structures')
        .set('Authorization', `Bearer ${teacherToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('2. Fee Structure Management', () => {
    it('should reject fee structure with invalid or non-positive amount', async () => {
      const res = await request(app)
        .post('/api/v1/fees/structures')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Invalid Amount Fee',
          academicYear: '2026-2027',
          totalAmount: -100,
        });
      expect(res.status).toBe(500);
      expect(res.body.message).toMatch(/positive number/i);
    });

    it('should successfully create a valid fee structure', async () => {
      const res = await request(app)
        .post('/api/v1/fees/structures')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          classId: sampleClassId,
          name: 'Annual Tuition & Computer Fee',
          academicYear: '2026-2027',
          category: 'TUITION',
          totalAmount: 12000,
          frequency: 'ANNUAL',
          description: 'Comprehensive curriculum and computer lab fee',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Annual Tuition & Computer Fee');
      expect(res.body.data.totalAmount).toBe(12000);
      createdStructureId = res.body.data.id;
    });

    it('should list fee structures filtered by academicYear', async () => {
      const res = await request(app)
        .get('/api/v1/fees/structures?academicYear=2026-2027')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('3. Student Fee Assignment & Installments', () => {
    it('should assign fee structure to student and generate installments', async () => {
      const res = await request(app)
        .post('/api/v1/fees/assign/student')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          studentId: sampleStudentId,
          feeStructureId: createdStructureId,
          academicYear: '2026-2027',
          installmentsCount: 3,
          firstDueDate: '2026-10-01',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.originalAmount).toBe(12000);
      expect(res.body.data.installments.length).toBe(3);
      expect(res.body.data.installments[0].amount).toBe(4000);
      assignedStudentFeeId = res.body.data.id;
    });

    it('should prevent duplicate fee structure assignment to the same student', async () => {
      const res = await request(app)
        .post('/api/v1/fees/assign/student')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          studentId: sampleStudentId,
          feeStructureId: createdStructureId,
        });

      expect(res.status).toBe(500);
      expect(res.body.message).toMatch(/has already been assigned/i);
    });
  });

  describe('4. Discounts & Scholarship Concessions', () => {
    it('should apply a discount and rebalance net payable & installments', async () => {
      const res = await request(app)
        .post(`/api/v1/fees/accounts/${assignedStudentFeeId}/discount`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          discountType: 'FIXED_AMOUNT',
          value: 2000,
          reason: 'Merit scholarship concession for district academic topper',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.updatedFee.discountAmount).toBe(2000);
      expect(res.body.data.updatedFee.netAmount).toBe(10000);
      expect(res.body.data.updatedFee.balanceAmount).toBe(10000);
    });

    it('should reject discount value exceeding total outstanding fee', async () => {
      const res = await request(app)
        .post(`/api/v1/fees/accounts/${assignedStudentFeeId}/discount`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          discountType: 'FIXED_AMOUNT',
          value: 20000,
          reason: 'Excessive discount test',
        });

      expect(res.status).toBe(500);
      expect(res.body.message).toMatch(/cannot exceed outstanding unpaid amount/i);
    });
  });

  describe('5. Payment Processing & Sequential Allocation', () => {
    it('should reject overpayment exceeding balance amount', async () => {
      const res = await request(app)
        .post('/api/v1/fees/payments')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          studentFeeId: assignedStudentFeeId,
          amountPaid: 15000, // Balance is only 10,000
          paymentMethod: 'CASH',
        });

      expect(res.status).toBe(500);
      expect(res.body.message).toMatch(/overpayment not permitted/i);
    });

    it('should record partial payment and generate unique receipt number', async () => {
      const res = await request(app)
        .post('/api/v1/fees/payments')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          studentFeeId: assignedStudentFeeId,
          amountPaid: 4000,
          paymentMethod: 'UPI',
          transactionReference: 'UPI-TXN-202611-98765',
          remarks: 'First installment payment via PhonePe UPI',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.payment.amountPaid).toBe(4000);
      expect(res.body.data.payment.receiptNumber).toMatch(/^REC-/);
      expect(res.body.data.updatedStudentFee.paidAmount).toBe(4000);
      expect(res.body.data.updatedStudentFee.balanceAmount).toBe(6000);

      recordedPaymentId = res.body.data.payment.id;
      generatedReceiptNumber = res.body.data.payment.receiptNumber;
    });

    it('should prevent duplicate transaction reference submission', async () => {
      const res = await request(app)
        .post('/api/v1/fees/payments')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          studentFeeId: assignedStudentFeeId,
          amountPaid: 1000,
          paymentMethod: 'UPI',
          transactionReference: 'UPI-TXN-202611-98765',
        });

      expect(res.status).toBe(500);
      expect(res.body.message).toMatch(/has already been processed/i);
    });

    it('should fetch receipt details by receipt number', async () => {
      const res = await request(app)
        .get(`/api/v1/fees/receipts/${generatedReceiptNumber}`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.receiptNumber).toBe(generatedReceiptNumber);
      expect(res.body.data.amountPaid).toBe(4000);
    });
  });

  describe('6. Payment Reversal & Balance Restoration', () => {
    it('should reject reversal from non-admin role with 403', async () => {
      const res = await request(app)
        .post(`/api/v1/fees/payments/${recordedPaymentId}/reverse`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ reason: 'Teacher reversal attempt' });

      expect(res.status).toBe(403);
    });

    it('should allow admin to reverse payment with reason and restore balances', async () => {
      const res = await request(app)
        .post(`/api/v1/fees/payments/${recordedPaymentId}/reverse`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          reason: 'Cheque bounced / UPI bank chargeback verified by bank branch',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.updatedPayment.isReversed).toBe(true);

      // Verify restored student statement
      const statementRes = await request(app)
        .get(`/api/v1/fees/students/${sampleStudentId}/statement`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(statementRes.status).toBe(200);
      expect(statementRes.body.data.summary.totalPaid).toBe(0);
      expect(statementRes.body.data.summary.totalOutstanding).toBe(10000);
    });
  });

  describe('7. Statements, Overdue Dues & Financial Reports', () => {
    it('should retrieve student fee statement with summary and breakdown', async () => {
      const res = await request(app)
        .get(`/api/v1/fees/students/${sampleStudentId}/statement`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.summary).toBeDefined();
      expect(res.body.data.accounts.length).toBeGreaterThanOrEqual(1);
    });

    it('should retrieve overdue fees list', async () => {
      const res = await request(app)
        .get('/api/v1/fees/overdue')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should retrieve institutional fee collection summary metrics', async () => {
      const res = await request(app)
        .get('/api/v1/fees/summary')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('totalBilled');
      expect(res.body.data).toHaveProperty('totalOutstanding');
      expect(res.body.data).toHaveProperty('collectionRate');
    });

    it('should export overdue fees to RFC 4180 CSV', async () => {
      const res = await request(app)
        .get('/api/v1/fees/export?type=overdue')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/text\/csv/);
      expect(res.text).toContain('Admission No,Student Name,Class');
    });

    it('should export payment records to RFC 4180 CSV', async () => {
      const res = await request(app)
        .get('/api/v1/fees/export?type=payments')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/text\/csv/);
      expect(res.text).toContain('Receipt No,Date,Student Name');
    });
  });
});
