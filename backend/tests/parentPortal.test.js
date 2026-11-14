import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/config/db.js';

describe('Parent Portal & School Communication Management Subsystem', () => {
  let adminToken;
  let teacherToken;
  let teacherUserId;
  let parentToken;
  let parentUserId;
  let parentId;
  let sampleStudent1;
  let sampleStudent2;
  let announcementId;
  let messageThreadId;

  const testParentEmail = `test.parent.${Date.now()}@shikshatrack.in`;
  const testParentPassword = 'ParentPassword123!';

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

    // 3. Resolve active students for linking tests
    const students = await prisma.student.findMany({
      where: { active: true },
      take: 2,
      include: { class: true },
    });
    expect(students.length).toBeGreaterThanOrEqual(2);
    sampleStudent1 = students[0];
    sampleStudent2 = students[1];

    // Clean up test communication / parent artifacts if any
    await prisma.announcementRead.deleteMany({});
    await prisma.communicationMessage.deleteMany({});
    await prisma.schoolAnnouncement.deleteMany({});
  });

  afterAll(async () => {
    // Cleanup created test records
    await prisma.announcementRead.deleteMany({});
    await prisma.communicationMessage.deleteMany({});
    await prisma.schoolAnnouncement.deleteMany({});
    if (parentUserId) {
      await prisma.parentStudent.deleteMany({ where: { parent: { userId: parentUserId } } });
      await prisma.parent.deleteMany({ where: { userId: parentUserId } });
      await prisma.user.deleteMany({ where: { id: parentUserId } });
    }
  });

  describe('1. Security & RBAC Access Control', () => {
    it('should reject unauthenticated request to parent management with 401', async () => {
      const res = await request(app).get('/api/v1/parents');
      expect(res.status).toBe(401);
    });

    it('should reject unauthenticated request to announcements with 401', async () => {
      const res = await request(app).get('/api/v1/communication/announcements');
      expect(res.status).toBe(401);
    });

    it('should reject teacher from registering a parent account (Admin only)', async () => {
      const res = await request(app)
        .post('/api/v1/parents')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          guardianName: 'Unauthorized Parent',
          email: 'unauth@example.com',
          password: 'password123',
          phone: '9876543210',
        });
      expect(res.status).toBe(403);
    });

    it('should reject non-admin/teacher from posting an announcement', async () => {
      const res = await request(app)
        .post('/api/v1/communication/announcements')
        .send({
          title: 'Fake Notice',
          content: 'No auth notice',
        });
      expect(res.status).toBe(401);
    });
  });

  describe('2. Parent Account Registration & Student Linking', () => {
    it('should allow admin to register a parent account with linked student', async () => {
      const res = await request(app)
        .post('/api/v1/parents')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          guardianName: 'Sunita Devi',
          email: testParentEmail,
          password: testParentPassword,
          phone: '9876543210',
          relationship: 'MOTHER',
          address: 'Ward 4, Bilaspur',
          occupation: 'Agriculture',
          studentIds: [sampleStudent1.id],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe(testParentEmail.toLowerCase());
      expect(res.body.data.parent.guardianName).toBe('Sunita Devi');
      expect(res.body.data.linkedStudents.length).toBe(1);
      expect(res.body.data.linkedStudents[0].id).toBe(sampleStudent1.id);

      parentUserId = res.body.data.user.id;
      parentId = res.body.data.parent.id;
    });

    it('should reject duplicate parent email registration with 409', async () => {
      const res = await request(app)
        .post('/api/v1/parents')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          guardianName: 'Sunita Duplicate',
          email: testParentEmail,
          password: 'AnotherPassword123!',
          phone: '9876543210',
          relationship: 'MOTHER',
        });

      expect(res.status).toBe(409);
    });

    it('should allow created parent to login and receive token with role PARENT', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testParentEmail,
          password: testParentPassword,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.user.role).toBe('PARENT');
      expect(res.body.data.user.parentProfile).toBeDefined();
      expect(res.body.data.user.parentProfile.children.length).toBe(1);

      parentToken = res.body.data.token;
    });

    it('should allow admin to link a second student to the parent', async () => {
      const res = await request(app)
        .post(`/api/v1/parents/${parentId}/link-student`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          studentId: sampleStudent2.id,
          relationship: 'MOTHER',
          isPrimaryContact: false,
          canPickup: true,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.student.id).toBe(sampleStudent2.id);
    });

    it('should allow parent to fetch all their linked children', async () => {
      const res = await request(app)
        .get('/api/v1/parents/my-children')
        .set('Authorization', `Bearer ${parentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(2);
      const studentIds = res.body.data.map((c) => c.studentId);
      expect(studentIds).toContain(sampleStudent1.id);
      expect(studentIds).toContain(sampleStudent2.id);
    });

    it('should allow admin to unlink a student from a parent', async () => {
      const res = await request(app)
        .delete(`/api/v1/parents/${parentId}/unlink-student/${sampleStudent2.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.success).toBe(true);
    });
  });

  describe('3. Parent Dashboard Aggregation & Security Scoping', () => {
    it('should retrieve comprehensive parent dashboard for linked child', async () => {
      const res = await request(app)
        .get('/api/v1/parents/dashboard')
        .set('Authorization', `Bearer ${parentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.parent.guardianName).toBe('Sunita Devi');
      expect(res.body.data.selectedStudent.id).toBe(sampleStudent1.id);
      expect(res.body.data.attendance).toBeDefined();
      expect(res.body.data.attendance.attendanceRate).toBeGreaterThanOrEqual(0);
      expect(res.body.data.examinations).toBeDefined();
      expect(res.body.data.fees).toBeDefined();
      expect(res.body.data.leaves).toBeDefined();
    });

    it('should prevent parent from accessing an unlinked student dashboard with 403', async () => {
      // sampleStudent2 was unlinked
      const res = await request(app)
        .get(`/api/v1/parents/dashboard?studentId=${sampleStudent2.id}`)
        .set('Authorization', `Bearer ${parentToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('4. School Announcements & Category Notifications', () => {
    it('should allow teacher to publish a school announcement', async () => {
      const res = await request(app)
        .post('/api/v1/communication/announcements')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          title: 'Special Parent-Teacher Meeting',
          content: 'The quarterly PTM will take place this Saturday from 9:00 AM to 1:00 PM.',
          category: 'ACADEMIC',
          priority: 'NORMAL',
          targetAudience: 'ALL',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.title).toBe('Special Parent-Teacher Meeting');
      expect(res.body.data.category).toBe('ACADEMIC');
      announcementId = res.body.data.id;
    });

    it('should allow parent to view published announcements', async () => {
      const res = await request(app)
        .get('/api/v1/communication/announcements')
        .set('Authorization', `Bearer ${parentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.announcements.length).toBeGreaterThan(0);
      const target = res.body.data.announcements.find((a) => a.id === announcementId);
      expect(target).toBeDefined();
    });

    it('should allow parent to mark an announcement as read', async () => {
      const res = await request(app)
        .post(`/api/v1/communication/announcements/${announcementId}/read`)
        .set('Authorization', `Bearer ${parentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.success).toBe(true);
    });
  });

  describe('5. Direct Messages & Communication Threads', () => {
    it('should allow parent to send a message to the class teacher', async () => {
      const res = await request(app)
        .post('/api/v1/communication/messages')
        .set('Authorization', `Bearer ${parentToken}`)
        .send({
          receiverId: teacherUserId,
          subject: 'Query regarding Rahul science homework',
          content: 'Hello Sir, could you clarify chapter 4 question 3 for Rahul?',
          category: 'ACADEMIC',
          studentId: sampleStudent1.id,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.subject).toBe('Query regarding Rahul science homework');
      expect(res.body.data.threadId).toBeDefined();
      messageThreadId = res.body.data.threadId;
    });

    it('should allow teacher to see incoming message in inbox', async () => {
      const res = await request(app)
        .get('/api/v1/communication/messages?box=inbox')
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.messages.length).toBeGreaterThan(0);
      const msg = res.body.data.messages.find((m) => m.threadId === messageThreadId);
      expect(msg).toBeDefined();
    });

    it('should allow teacher to retrieve the conversation thread and reply', async () => {
      const threadRes = await request(app)
        .get(`/api/v1/communication/messages/threads/${messageThreadId}`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(threadRes.status).toBe(200);
      expect(threadRes.body.data.messages.length).toBe(1);

      // Reply
      const replyRes = await request(app)
        .post(`/api/v1/communication/messages/threads/${messageThreadId}/reply`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          content: 'Dear Guardian, Rahul needs to complete questions 1 through 5 on page 42.',
        });

      expect(replyRes.status).toBe(201);
      expect(replyRes.body.data.senderId).toBe(teacherUserId);
    });

    it('should allow parent to view updated thread with teacher reply', async () => {
      const res = await request(app)
        .get(`/api/v1/communication/messages/threads/${messageThreadId}`)
        .set('Authorization', `Bearer ${parentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.messages.length).toBe(2);
    });
  });

  describe('6. Parent Leave Application Submission', () => {
    it('should allow parent to submit student leave application', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dayAfter = new Date();
      dayAfter.setDate(dayAfter.getDate() + 2);

      const res = await request(app)
        .post('/api/v1/parents/leaves')
        .set('Authorization', `Bearer ${parentToken}`)
        .send({
          studentId: sampleStudent1.id,
          leaveType: 'SICK',
          startDate: tomorrow.toISOString().split('T')[0],
          endDate: dayAfter.toISOString().split('T')[0],
          reason: 'Fever and viral infection, doctor recommended rest.',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe('PENDING');
      expect(res.body.data.studentId).toBe(sampleStudent1.id);
    });

    it('should prevent parent from applying leave for an unlinked student with 403', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dayAfter = new Date();
      dayAfter.setDate(dayAfter.getDate() + 2);

      const res = await request(app)
        .post('/api/v1/parents/leaves')
        .set('Authorization', `Bearer ${parentToken}`)
        .send({
          studentId: sampleStudent2.id,
          leaveType: 'FAMILY',
          startDate: tomorrow.toISOString().split('T')[0],
          endDate: dayAfter.toISOString().split('T')[0],
          reason: 'Unauthorized leave submission test.',
        });

      expect(res.status).toBe(403);
    });
  });
});
