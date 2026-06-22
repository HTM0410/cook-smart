const request = require('supertest');

// Base URL for backend API
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';

describe('Profile API E2E', () => {
  // Ensure backend is running separately before running these tests
  it('GET /health should return OK', async () => {
    const res = await request(API_BASE_URL).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('OK');
  });

  it('GET /api/profile/1 should return user profile with stats', async () => {
    const res = await request(API_BASE_URL).get('/api/profile/1');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('id');
    expect(res.body.data).toHaveProperty('email');
    expect(res.body.data).toHaveProperty('stats');
  });

  it('GET /api/profile/1/favorites should return list of recipes', async () => {
    const res = await request(API_BASE_URL).get('/api/profile/1/favorites');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('recipes');
    expect(res.body.data).toHaveProperty('pagination');
  });

  it('GET /api/profile/1/activity should return activities', async () => {
    const res = await request(API_BASE_URL).get('/api/profile/1/activity');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('activities');
  });

  it('GET /api/profile/1/reviews should return reviews list', async () => {
    const res = await request(API_BASE_URL).get('/api/profile/1/reviews');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('reviews');
  });
});


