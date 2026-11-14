import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';

describe('Student CRUD & QR Tokens API', () => {
  let adminToken;
  let sampleClassId;

  beforeAll(async () => {
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@shikshatrack.in', password: 'admin123' });
    adminToken = loginRes.body.data.token;

    const classRes = await request(app)
      .get('/api/v1/classes')
      .set('Authorization', `Bearer ${adminToken}`);
    sampleClassId = classRes.body.data[0].id;
  });

  it('GET /api/v1/students - should list students with pagination', async () => {
    const res = await request(app)
      .get('/api/v1/students')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.students)).toBe(true);
    expect(res.body.data.students.length).toBeGreaterThan(0);
  });

  it('POST /api/v1/students - should create new student with automatic QR token', async () => {
    const randomNum = Math.floor(10000 + Math.random() * 90000);
    const newStudent = {
      name: `Test Student ${randomNum}`,
      admissionNumber: `TEST-ADM-${randomNum}`,
      rollNumber: '99',
      classId: sampleClassId,
      guardianName: 'Guardian Test',
      guardianPhone: '+91 99999 88888',
    };

    const res = await request(app)
      .post('/api/v1/students')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(newStudent);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.qrToken).toBeDefined();
    expect(res.body.data.qrToken.startsWith('ST-')).toBe(true);
    expect(res.body.data.qrDataUrl).toBeDefined();
  });

  it('POST /api/v1/students - should reject duplicate admission numbers in the same school', async () => {
    const dupStudent = {
      name: 'Duplicate Student',
      admissionNumber: 'ADM-2026-0001', // Already seeded
      classId: sampleClassId,
    };

    const res = await request(app)
      .post('/api/v1/students')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(dupStudent);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('POST /api/v1/students - should reject malformed phone numbers and negative roll numbers', async () => {
    const invalidPhoneStudent = {
      name: 'Bad Phone Student',
      admissionNumber: `TEST-ADM-${Date.now()}-1`,
      classId: sampleClassId,
      guardianPhone: '12345', // less than 10 digits
    };

    const res1 = await request(app)
      .post('/api/v1/students')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(invalidPhoneStudent);

    expect(res1.status).toBe(400);
    expect(res1.body.success).toBe(false);
    expect(res1.body.message).toContain('phone');

    const invalidRollStudent = {
      name: 'Bad Roll Student',
      admissionNumber: `TEST-ADM-${Date.now()}-2`,
      classId: sampleClassId,
      rollNumber: '-5', // negative
    };

    const res2 = await request(app)
      .post('/api/v1/students')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(invalidRollStudent);

    expect(res2.status).toBe(400);
    expect(res2.body.success).toBe(false);
    expect(res2.body.message).toContain('Roll number');
  });

  it('PUT /api/v1/students/:id - should reject invalid gender enum value', async () => {
    // Get existing student
    const listRes = await request(app)
      .get('/api/v1/students?limit=1')
      .set('Authorization', `Bearer ${adminToken}`);
    const targetStudent = listRes.body.data.students[0];

    const res = await request(app)
      .put(`/api/v1/students/${targetStudent.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ gender: 'InvalidGenderValue' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('Gender must be one of');
  });

  it('POST /api/v1/students - should trim whitespace and normalize admission numbers to uppercase', async () => {
    const randomNum = Math.floor(10000 + Math.random() * 90000);
    const newStudent = {
      name: `Normalized Student ${randomNum}`,
      admissionNumber: `   adm-norm-${randomNum}   `,
      classId: sampleClassId,
    };

    const res = await request(app)
      .post('/api/v1/students')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(newStudent);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.admissionNumber).toBe(`ADM-NORM-${randomNum}`);
  });

  it('POST /api/v1/students - should reject empty admission numbers', async () => {
    const emptyStudent = {
      name: 'Empty Admission Student',
      admissionNumber: '',
      classId: sampleClassId,
    };

    const res1 = await request(app)
      .post('/api/v1/students')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(emptyStudent);

    expect(res1.status).toBe(400);
    expect(res1.body.success).toBe(false);
    expect(res1.body.message).toContain('Admission number');

    const whitespaceStudent = {
      name: 'Whitespace Admission Student',
      admissionNumber: '     ',
      classId: sampleClassId,
    };

    const res2 = await request(app)
      .post('/api/v1/students')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(whitespaceStudent);

    expect(res2.status).toBe(400);
    expect(res2.body.success).toBe(false);
    expect(res2.body.message).toContain('Admission number');
  });

  it('POST /api/v1/students - should allow only letters, numbers, and hyphens in admission numbers', async () => {
    const underscoreStudent = {
      name: 'Underscore Student',
      admissionNumber: 'ADM_2026_0099',
      classId: sampleClassId,
    };

    const res1 = await request(app)
      .post('/api/v1/students')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(underscoreStudent);

    expect(res1.status).toBe(400);
    expect(res1.body.success).toBe(false);
    expect(res1.body.message).toContain('only letters, numbers, and hyphens');

    const spaceStudent = {
      name: 'Space Student',
      admissionNumber: 'ADM 2026 0099',
      classId: sampleClassId,
    };

    const res2 = await request(app)
      .post('/api/v1/students')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(spaceStudent);

    expect(res2.status).toBe(400);
    expect(res2.body.success).toBe(false);
    expect(res2.body.message).toContain('only letters, numbers, and hyphens');

    const symbolStudent = {
      name: 'Symbol Student',
      admissionNumber: 'ADM#2026@0099',
      classId: sampleClassId,
    };

    const res3 = await request(app)
      .post('/api/v1/students')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(symbolStudent);

    expect(res3.status).toBe(400);
    expect(res3.body.success).toBe(false);
    expect(res3.body.message).toContain('only letters, numbers, and hyphens');
  });

  it('PUT /api/v1/students/:id - should normalize and validate admission numbers during student updates', async () => {
    // 1. Fetch a student to update
    const listRes = await request(app)
      .get('/api/v1/students?limit=5')
      .set('Authorization', `Bearer ${adminToken}`);
    const targetStudent = listRes.body.data.students[0];
    const otherStudent = listRes.body.data.students[1];

    const randomNum = Math.floor(10000 + Math.random() * 90000);
    const updatedAdm = `   upd-adm-${randomNum}   `;

    // 2. Successful update with trimming and uppercase normalization
    const resSuccess = await request(app)
      .put(`/api/v1/students/${targetStudent.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ admissionNumber: updatedAdm });

    expect(resSuccess.status).toBe(200);
    expect(resSuccess.body.success).toBe(true);
    expect(resSuccess.body.data.admissionNumber).toBe(`UPD-ADM-${randomNum}`);

    // 3. Reject empty admission number update
    const resEmpty = await request(app)
      .put(`/api/v1/students/${targetStudent.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ admissionNumber: '   ' });

    expect(resEmpty.status).toBe(400);
    expect(resEmpty.body.success).toBe(false);
    expect(resEmpty.body.message).toContain('Admission number');

    // 4. Reject invalid characters update
    const resInvalid = await request(app)
      .put(`/api/v1/students/${targetStudent.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ admissionNumber: 'INVALID_CHAR_123' });

    expect(resInvalid.status).toBe(400);
    expect(resInvalid.body.success).toBe(false);
    expect(resInvalid.body.message).toContain('only letters, numbers, and hyphens');

    // 5. Reject duplicate admission number update
    if (otherStudent) {
      const resDup = await request(app)
        .put(`/api/v1/students/${targetStudent.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ admissionNumber: otherStudent.admissionNumber.toLowerCase() });

      expect(resDup.status).toBe(400);
      expect(resDup.body.success).toBe(false);
      expect(resDup.body.message).toContain('already used');
    }
  });

  describe('Bulk Student CSV Import API', () => {
    it('POST /api/v1/students/import - should reject empty or malformed CSV content', async () => {
      const res1 = await request(app)
        .post('/api/v1/students/import')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ csvContent: '' });

      expect(res1.status).toBe(400);
      expect(res1.body.success).toBe(false);

      const res2 = await request(app)
        .post('/api/v1/students/import')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ csvContent: 'only_one_header_line_without_rows' });

      expect(res2.status).toBe(400);
      expect(res2.body.message).toContain('at least one data row');
    });

    it('POST /api/v1/students/import - should reject CSV with missing required headers', async () => {
      const badHeaderCsv = `student_roll,guardian_phone\n1,9876543210`;
      const res = await request(app)
        .post('/api/v1/students/import')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ csvContent: badHeaderCsv, defaultClassId: sampleClassId });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('mandatory');
    });

    it('POST /api/v1/students/import - should successfully import valid student CSV rows', async () => {
      const r1 = Math.floor(10000 + Math.random() * 90000);
      const r2 = Math.floor(10000 + Math.random() * 90000);

      const validCsv = `name,admissionNumber,rollNumber,gender\n"Kavya Sharma",IMP-ADM-${r1},21,FEMALE\n"Manish Patel",IMP-ADM-${r2},22,MALE`;

      const res = await request(app)
        .post('/api/v1/students/import')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          csvContent: validCsv,
          defaultClassId: sampleClassId,
        });

      expect([200, 201]).toContain(res.status);
      expect(res.body.success).toBe(true);
      expect(res.body.data.summary.importedCount).toBe(2);
      expect(res.body.data.summary.failedCount).toBe(0);
      expect(res.body.data.importedStudents.length).toBe(2);
      expect(res.body.data.importedStudents[0].admissionNumber).toBe(`IMP-ADM-${r1}`);
    });

    it('POST /api/v1/students/import - should detect duplicate admission numbers in CSV and existing DB records', async () => {
      const r3 = Math.floor(10000 + Math.random() * 90000);
      // Fetch an existing student
      const existingList = await request(app)
        .get('/api/v1/students?limit=1')
        .set('Authorization', `Bearer ${adminToken}`);
      const existingAdm = existingList.body.data.students[0].admissionNumber;

      const dupCsv = `name,admissionNumber,rollNumber\n"New Student 1",BATCH-DUP-${r3},31\n"Duplicate Batch Student",BATCH-DUP-${r3},32\n"Existing DB Student",${existingAdm},33`;

      const res = await request(app)
        .post('/api/v1/students/import')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          csvContent: dupCsv,
          defaultClassId: sampleClassId,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.summary.importedCount).toBe(1);
      expect(res.body.data.summary.skippedCount).toBe(2);
      expect(res.body.data.errors.length).toBe(2);
      expect(res.body.data.errors.some((e) => e.error.includes('multiple times'))).toBe(true);
      expect(res.body.data.errors.some((e) => e.error.includes('already exists'))).toBe(true);
    });

    it('POST /api/v1/students/import - should provide row-level validation errors for invalid values', async () => {
      const invalidRowCsv = `name,admissionNumber,rollNumber\nA,INVALID#ADM,41`;

      const res = await request(app)
        .post('/api/v1/students/import')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          csvContent: invalidRowCsv,
          defaultClassId: sampleClassId,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.summary.importedCount).toBe(0);
      expect(res.body.data.summary.failedCount).toBeGreaterThanOrEqual(1);
      expect(res.body.data.errors[0].row).toBe(2);
      expect(res.body.data.errors[0].error).toBeDefined();
    });
  });
});

