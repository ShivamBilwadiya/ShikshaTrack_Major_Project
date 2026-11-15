import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/config/db.js';

describe('Student Academic Promotion & Rollover API', () => {
  let adminToken;
  let adminUser;
  let teacherToken;
  let classSource;
  let classTarget;
  let otherSchoolClass;
  let testStudent1;
  let testStudent2;

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

    // 3. Create test source & target classes for promotion testing
    classSource = await prisma.class.create({
      data: {
        name: `Class 7 Promotion Source ${Date.now()}`,
        section: 'A',
        academicYear: '2026-2027',
        schoolId: adminUser.schoolId,
      },
    });

    classTarget = await prisma.class.create({
      data: {
        name: `Class 8 Promotion Target ${Date.now()}`,
        section: 'A',
        academicYear: '2027-2028',
        schoolId: adminUser.schoolId,
      },
    });

    // 4. Create another school & class for isolation testing
    const otherSchool = await prisma.school.create({
      data: {
        name: `Other Isolated School ${Date.now()}`,
        code: `ISO-${Date.now().toString().slice(-4)}`,
        address: 'Out of district',
      },
    });

    otherSchoolClass = await prisma.class.create({
      data: {
        name: 'Class 9 Isolated',
        section: 'B',
        academicYear: '2027-2028',
        schoolId: otherSchool.id,
      },
    });

    // 5. Create test students in source class
    testStudent1 = await prisma.student.create({
      data: {
        name: 'Promotion Candidate 1',
        admissionNumber: `PROM-1-${Date.now()}`,
        rollNumber: '01',
        classId: classSource.id,
        schoolId: adminUser.schoolId,
        active: true,
      },
    });

    testStudent2 = await prisma.student.create({
      data: {
        name: 'Promotion Candidate 2',
        admissionNumber: `PROM-2-${Date.now()}`,
        rollNumber: '02',
        classId: classSource.id,
        schoolId: adminUser.schoolId,
        active: true,
      },
    });
  });

  afterAll(async () => {
    // Cleanup created test records
    try {
      if (testStudent1 || testStudent2) {
        await prisma.auditLog.deleteMany({
          where: { entityId: { in: [testStudent1?.id, testStudent2?.id].filter(Boolean) } },
        });
        await prisma.student.deleteMany({
          where: { id: { in: [testStudent1?.id, testStudent2?.id].filter(Boolean) } },
        });
      }
      if (classSource) await prisma.class.deleteMany({ where: { id: classSource.id } });
      if (classTarget) await prisma.class.deleteMany({ where: { id: classTarget.id } });
      if (otherSchoolClass) {
        await prisma.class.deleteMany({ where: { id: otherSchoolClass.id } });
        await prisma.school.deleteMany({ where: { id: otherSchoolClass.schoolId } });
      }
    } catch (e) {
      // Best effort cleanup
    }
  });

  describe('Authorization & Access Control', () => {
    it('should reject unauthenticated request with 401', async () => {
      const res = await request(app).get('/api/v1/academic/promotion/classes');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should reject non-admin (TEACHER) access with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/v1/academic/promotion/classes')
        .set('Authorization', `Bearer ${teacherToken}`);
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });

  describe('Promotion Preview & Cohort Analysis', () => {
    it('should preview eligible candidates in source class', async () => {
      const res = await request(app)
        .post('/api/v1/academic/promotion/preview')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          sourceClassId: classSource.id,
          targetClassId: classTarget.id,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.sourceClass.id).toBe(classSource.id);
      expect(res.body.data.targetClass.id).toBe(classTarget.id);
      expect(res.body.data.eligibleCount).toBe(2);
      expect(res.body.data.students.length).toBe(2);
    });
  });

  describe('Validation & Mapping Constraints', () => {
    it('should reject identical source and destination class mapping', async () => {
      const res = await request(app)
        .post('/api/v1/academic/promotion/preview')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          sourceClassId: classSource.id,
          targetClassId: classSource.id,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Destination class cannot be identical');
    });

    it('should enforce school-level data isolation and reject foreign destination class', async () => {
      const res = await request(app)
        .post('/api/v1/academic/promotion/preview')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          sourceClassId: classSource.id,
          targetClassId: otherSchoolClass.id,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Destination class not found');
    });
  });

  describe('Bulk Promotion Execution & Idempotency', () => {
    it('should execute transactional bulk promotion and record audit trail', async () => {
      const res = await request(app)
        .post('/api/v1/academic/promotion/execute')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          promotions: [
            {
              sourceClassId: classSource.id,
              targetClassId: classTarget.id,
              studentIds: [testStudent1.id, testStudent2.id],
              action: 'PROMOTE',
            },
          ],
          reason: 'Annual Grade 7 -> Grade 8 Rollover',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalPromoted).toBe(2);

      // Verify database updates
      const updatedStudent1 = await prisma.student.findUnique({
        where: { id: testStudent1.id },
      });
      expect(updatedStudent1.classId).toBe(classTarget.id);

      // Verify AuditLog entry
      const log = await prisma.auditLog.findFirst({
        where: {
          entityId: testStudent1.id,
          action: 'STUDENT_PROMOTED',
        },
      });
      expect(log).toBeDefined();
      expect(log.actorId).toBe(adminUser.id);
    });

    it('should prevent duplicate promotions gracefully', async () => {
      // Re-executing promotion for students already in target class
      const res = await request(app)
        .post('/api/v1/academic/promotion/execute')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          promotions: [
            {
              sourceClassId: classTarget.id, // Now in classTarget
              targetClassId: classTarget.id, // Attempting to promote to same
              studentIds: [testStudent1.id],
              action: 'PROMOTE',
            },
          ],
        });

      // Rejected because destination is identical
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });
});
