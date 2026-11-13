import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';

describe('AI Subsystem & Anomaly Detection API', () => {
  let adminToken;

  beforeAll(async () => {
    const adminRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@shikshatrack.in', password: 'admin123' });
    adminToken = adminRes.body.data.token;
  });

  it('GET /api/v1/ai/insights - should generate aggregated observations', async () => {
    const res = await request(app)
      .get('/api/v1/ai/insights')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.insights).toBeDefined();
  });

  it('POST /api/v1/ai/ask - should map natural language query to safe DB query intent', async () => {
    const res = await request(app)
      .post('/api/v1/ai/ask')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ query: 'Which students have attendance below 75%?' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.intent).toBe('LOW_ATTENDANCE_QUERY');
    expect(res.body.data.answer).toBeDefined();
  });

  it('POST /api/v1/ai/ask - should identify lowest attendance class query', async () => {
    const res = await request(app)
      .post('/api/v1/ai/ask')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ query: 'Which class had lowest attendance?' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.intent).toBe('LOWEST_CLASS_QUERY');
    expect(res.body.data.answer).toContain('lowest attendance');
  });

  it('POST /api/v1/ai/ask - should answer questions about late arrivals', async () => {
    const res = await request(app)
      .post('/api/v1/ai/ask')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ query: 'How many students were late today?' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.intent).toBe('LATE_ARRIVALS_QUERY');
    expect(res.body.data.answer).toContain('LATE');
  });

  it('GET /api/v1/analytics/anomalies - should run statistical anomaly detection rules', async () => {
    const res = await request(app)
      .get('/api/v1/analytics/anomalies')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

