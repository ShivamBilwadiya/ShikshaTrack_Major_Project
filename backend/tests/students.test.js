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
});

