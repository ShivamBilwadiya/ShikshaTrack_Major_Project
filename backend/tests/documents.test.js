import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/config/db.js';

describe('Student Certificate Generation & Digital Document Management Subsystem', () => {
  let adminToken;
  let adminUser;
  let teacherToken;
  let parentToken;
  let parentUserId;
  let parentRecordId;
  let sampleStudent1;
  let sampleStudent2;
  let createdDocumentId;
  let createdTemplateId;
  let issuedCertificateId;
  let issuedCertificateNumber;
  let issuedVerificationToken;

  // Base64 dummy PDF payload for testing
  const dummyPdfBuffer = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n%%EOF');
  const dummyPdfBase64 = dummyPdfBuffer.toString('base64');

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

    // 3. Resolve active students
    const students = await prisma.student.findMany({
      where: { active: true },
      take: 2,
      include: { class: true },
    });
    expect(students.length).toBeGreaterThanOrEqual(2);
    sampleStudent1 = students[0];
    sampleStudent2 = students[1];

    // 4. Create a test parent account linked to sampleStudent1 only
    const testParentEmail = `parent.docs.${Date.now()}@shikshatrack.in`;
    const parentUser = await prisma.user.create({
      data: {
        name: 'Document Test Guardian',
        email: testParentEmail,
        passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGHIJK',
        role: 'PARENT',
        schoolId: adminUser.schoolId,
      },
    });
    parentUserId = parentUser.id;

    const parentProfile = await prisma.parent.create({
      data: {
        userId: parentUserId,
        schoolId: adminUser.schoolId,
        guardianName: 'Document Test Guardian',
        phone: '9876543210',
        relationship: 'FATHER',
      },
    });
    parentRecordId = parentProfile.id;

    // Link only to student 1
    await prisma.parentStudent.create({
      data: {
        parentId: parentRecordId,
        studentId: sampleStudent1.id,
        isPrimaryContact: true,
      },
    });

    // Parent login token
    const parentLoginRes = await request(app)
      .post('/api/v1/parents/login')
      .send({ email: testParentEmail, phone: '9876543210' })
      .catch(() => null);

    if (parentLoginRes && parentLoginRes.status === 200) {
      parentToken = parentLoginRes.body.data.token;
    } else {
      // Fallback: regular token signed with jwt
      const jwt = (await import('jsonwebtoken')).default;
      const { config } = await import('../src/config/env.js');
      parentToken = jwt.sign({ userId: parentUserId, role: 'PARENT' }, config.jwtSecret, {
        expiresIn: '1d',
      });
    }

    // Clean up test documents and certificates
    await prisma.certificateVerificationLog.deleteMany({});
    await prisma.issuedCertificate.deleteMany({});
    await prisma.documentVersion.deleteMany({});
    await prisma.studentDocument.deleteMany({});
  });

  afterAll(async () => {
    // Cleanup
    await prisma.certificateVerificationLog.deleteMany({});
    await prisma.issuedCertificate.deleteMany({});
    if (createdTemplateId) {
      await prisma.certificateTemplate.deleteMany({ where: { id: createdTemplateId } });
    }
    await prisma.documentVersion.deleteMany({});
    await prisma.studentDocument.deleteMany({});
    if (parentRecordId) {
      await prisma.parentStudent.deleteMany({ where: { parentId: parentRecordId } });
      await prisma.parent.deleteMany({ where: { id: parentRecordId } });
    }
    if (parentUserId) {
      await prisma.user.deleteMany({ where: { id: parentUserId } });
    }
  });

  describe('1. Security & RBAC Access Control', () => {
    it('GET /api/v1/documents - should reject unauthenticated request with 401', async () => {
      const res = await request(app).get('/api/v1/documents');
      expect(res.status).toBe(401);
    });

    it('GET /api/v1/certificates - should reject unauthenticated request with 401', async () => {
      const res = await request(app).get('/api/v1/certificates');
      expect(res.status).toBe(401);
    });

    it('GET /api/v1/certificates/verify/:token - should be publicly accessible without token', async () => {
      const res = await request(app).get('/api/v1/certificates/verify/NON_EXISTENT_TOKEN_123');
      // Should not return 401 Unauthorized; should return 404 (not found) or 200
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('POST /api/v1/certificates/templates - should reject non-admin with 403', async () => {
      const res = await request(app)
        .post('/api/v1/certificates/templates')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          name: 'Unauthorized Template',
          title: 'TEST',
          bodyTemplate: 'Body',
        });
      expect(res.status).toBe(403);
    });
  });

  describe('2. Student Document Management & Versioning', () => {
    it('POST /api/v1/documents - should upload student document and initialize version 1', async () => {
      const res = await request(app)
        .post('/api/v1/documents')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          studentId: sampleStudent1.id,
          title: 'Birth Certificate Official',
          category: 'BIRTH_CERTIFICATE',
          description: 'Original municipal corporation birth certificate',
          issueDate: '2015-05-15',
          originalName: 'birth_cert_scan.pdf',
          mimeType: 'application/pdf',
          fileBase64: dummyPdfBase64,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.currentVersion).toBe(1);
      expect(res.body.data.status).toBe('PENDING');
      expect(res.body.data.versions.length).toBe(1);

      createdDocumentId = res.body.data.id;
    });

    it('POST /api/v1/documents - should reject upload without fileBase64', async () => {
      const res = await request(app)
        .post('/api/v1/documents')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          studentId: sampleStudent1.id,
          title: 'Incomplete Document',
          category: 'OTHER',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('GET /api/v1/documents/:id - should retrieve document details with version history', async () => {
      const res = await request(app)
        .get(`/api/v1/documents/${createdDocumentId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.title).toBe('Birth Certificate Official');
      expect(res.body.data.student.id).toBe(sampleStudent1.id);
      expect(res.body.data.versions[0].versionNumber).toBe(1);
    });

    it('POST /api/v1/documents/:id/replace - should upload replacement version (v2) and preserve history', async () => {
      const v2Buffer = Buffer.from('%PDF-1.4\n% Version 2 Updated Content\n%%EOF');
      const v2Base64 = v2Buffer.toString('base64');

      const res = await request(app)
        .post(`/api/v1/documents/${createdDocumentId}/replace`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          originalName: 'birth_cert_scan_v2.pdf',
          mimeType: 'application/pdf',
          fileBase64: v2Base64,
          changeReason: 'Uploaded high resolution color scan',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.currentVersion).toBe(2);
      expect(res.body.data.versions.length).toBe(2);
      expect(res.body.data.versions[0].versionNumber).toBe(2);
      expect(res.body.data.versions[0].changeReason).toBe('Uploaded high resolution color scan');
    });

    it('GET /api/v1/documents/:id/download - should download current document file', async () => {
      const res = await request(app)
        .get(`/api/v1/documents/${createdDocumentId}/download`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/pdf');
      expect(res.headers['content-disposition']).toContain('attachment');
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('GET /api/v1/documents/:id/download?version=1 - should download historical version 1', async () => {
      const res = await request(app)
        .get(`/api/v1/documents/${createdDocumentId}/download?version=1`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/pdf');
      expect(res.body.length).toBe(dummyPdfBuffer.length);
    });

    it('POST /api/v1/documents/:id/verify - should review and update status to VERIFIED', async () => {
      const res = await request(app)
        .post(`/api/v1/documents/${createdDocumentId}/verify`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'VERIFIED',
          verificationNotes: 'Verified against municipal civil registration database',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('VERIFIED');
      expect(res.body.data.verificationNotes).toContain('Verified against municipal');
    });

    it('GET /api/v1/documents - should search and filter by student and category', async () => {
      const res = await request(app)
        .get(`/api/v1/documents?studentId=${sampleStudent1.id}&category=BIRTH_CERTIFICATE`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.documents.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.documents[0].id).toBe(createdDocumentId);
    });

    it('GET /api/v1/documents/stats - should return document summary metrics', async () => {
      const res = await request(app)
        .get('/api/v1/documents/stats')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.totalDocuments).toBeGreaterThanOrEqual(1);
      expect(res.body.data.verifiedCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe('3. Certificate Template Engine & Issuance', () => {
    it('GET /api/v1/certificates/templates - should list or auto-seed standard certificate templates', async () => {
      const res = await request(app)
        .get('/api/v1/certificates/templates')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('POST /api/v1/certificates/templates - should create custom certificate template', async () => {
      const templateName = `Honors Award Template ${Date.now()}`;
      const res = await request(app)
        .post('/api/v1/certificates/templates')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: templateName,
          type: 'ACHIEVEMENT',
          title: 'ACADEMIC MERIT CITATION',
          bodyTemplate:
            'This is to certify that {{student_name}} of {{class_name}} (Admission No: {{admission_no}}) has been awarded first prize in the Annual Science Fair.',
          signatoryTitle: 'Head of Science Department & Principal',
          watermarkText: 'SCHOLASTIC MERIT',
          validityMonths: 24,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.name).toBe(templateName);

      createdTemplateId = res.body.data.id;
    });

    it('POST /api/v1/certificates/issue - should issue certificate with frozen student snapshot and unique certificate number', async () => {
      const res = await request(app)
        .post('/api/v1/certificates/issue')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          studentId: sampleStudent1.id,
          templateId: createdTemplateId,
          signatoryName: 'Dr. Ramesh Sharma',
          remarks: 'Awarded during Republic Day assembly',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.certificateNumber).toBeDefined();
      expect(res.body.data.verificationToken).toBeDefined();
      expect(res.body.data.studentSnapshot.name).toBe(sampleStudent1.name);
      expect(res.body.data.studentSnapshot.admissionNumber).toBe(sampleStudent1.admissionNumber);
      expect(res.body.data.status).toBe('ACTIVE');

      issuedCertificateId = res.body.data.id;
      issuedCertificateNumber = res.body.data.certificateNumber;
      issuedVerificationToken = res.body.data.verificationToken;
    });

    it('GET /api/v1/certificates/:id - should retrieve full certificate details', async () => {
      const res = await request(app)
        .get(`/api/v1/certificates/${issuedCertificateId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.certificateNumber).toBe(issuedCertificateNumber);
      expect(res.body.data.student.id).toBe(sampleStudent1.id);
    });

    it('GET /api/v1/certificates/:id/pdf - should generate and stream valid printable PDF with vector QR code', async () => {
      const res = await request(app)
        .get(`/api/v1/certificates/${issuedCertificateId}/pdf`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/pdf');
      expect(res.body.length).toBeGreaterThan(1000);

      // Verify PDF header magic bytes (%PDF-1.4)
      const pdfHeader = res.body.toString('utf8', 0, 8);
      expect(pdfHeader).toContain('%PDF-1.');
    });

    it('GET /api/v1/certificates - should list certificates with pagination and class filter', async () => {
      const res = await request(app)
        .get(`/api/v1/certificates?studentId=${sampleStudent1.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.certificates.length).toBeGreaterThanOrEqual(1);
    });

    it('GET /api/v1/certificates/stats - should return certificate statistical counters', async () => {
      const res = await request(app)
        .get('/api/v1/certificates/stats')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.totalIssued).toBeGreaterThanOrEqual(1);
      expect(res.body.data.activeCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe('4. Certificate Public Verification & Revocation Workflow', () => {
    it('GET /api/v1/certificates/verify/:token - should publicly verify authentic certificate with safe payload', async () => {
      const res = await request(app).get(`/api/v1/certificates/verify/${issuedVerificationToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isValid).toBe(true);
      expect(res.body.data.status).toBe('ACTIVE');
      expect(res.body.data.certificateNumber).toBe(issuedCertificateNumber);
      expect(res.body.data.studentName).toBe(sampleStudent1.name);
      expect(res.body.data.schoolName).toBeDefined();

      // Ensure verification log was recorded
      const logCount = await prisma.certificateVerificationLog.count({
        where: { certificateId: issuedCertificateId },
      });
      expect(logCount).toBeGreaterThanOrEqual(1);
    });

    it('GET /api/v1/certificates/verify/:certNo - should also verify using certificate number sequence', async () => {
      const res = await request(app).get(`/api/v1/certificates/verify/${issuedCertificateNumber}`);

      expect(res.status).toBe(200);
      expect(res.body.data.isValid).toBe(true);
      expect(res.body.data.certificateNumber).toBe(issuedCertificateNumber);
    });

    it('POST /api/v1/certificates/:id/revoke - should revoke certificate with audit trail', async () => {
      const res = await request(app)
        .post(`/api/v1/certificates/${issuedCertificateId}/revoke`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          reason: 'Student transferred to higher secondary boarding school in another district',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('REVOKED');
      expect(res.body.data.revocationReason).toContain('Student transferred');
    });

    it('GET /api/v1/certificates/verify/:token - should now reflect revoked status on public query', async () => {
      const res = await request(app).get(`/api/v1/certificates/verify/${issuedVerificationToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.isValid).toBe(false);
      expect(res.body.data.status).toBe('REVOKED');
      expect(res.body.data.revocation.reason).toContain('Student transferred');
    });
  });

  describe('5. Parent Access Restrictions & School Isolation', () => {
    it('Parent should be able to view documents of their linked child', async () => {
      const res = await request(app)
        .get(`/api/v1/documents?studentId=${sampleStudent1.id}`)
        .set('Authorization', `Bearer ${parentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.documents.length).toBeGreaterThanOrEqual(1);
    });

    it('Parent should be denied when attempting to access documents of an unlinked student', async () => {
      const res = await request(app)
        .get(`/api/v1/documents?studentId=${sampleStudent2.id}`)
        .set('Authorization', `Bearer ${parentToken}`);

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Unauthorized: You can only view documents for your registered children');
    });

    it('Parent should be denied when accessing single document of unlinked student', async () => {
      // Create a document for student 2
      const doc2 = await prisma.studentDocument.create({
        data: {
          schoolId: adminUser.schoolId,
          studentId: sampleStudent2.id,
          uploadedById: adminUser.id,
          title: 'Unlinked Student Record',
          category: 'ACADEMIC_RECORD',
          filePath: 'uploads/documents/test_dummy.pdf',
          fileName: 'test.pdf',
          fileSize: 100,
          mimeType: 'application/pdf',
        },
      });

      const res = await request(app)
        .get(`/api/v1/documents/${doc2.id}`)
        .set('Authorization', `Bearer ${parentToken}`);

      expect(res.status).toBe(404); // Or 400 forbidden

      await prisma.studentDocument.delete({ where: { id: doc2.id } });
    });

    it('DELETE /api/v1/documents/:id - should permanently delete document and versions', async () => {
      const res = await request(app)
        .delete(`/api/v1/documents/${createdDocumentId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.success).toBe(true);

      const check = await prisma.studentDocument.findUnique({ where: { id: createdDocumentId } });
      expect(check).toBeNull();
    });
  });
});
