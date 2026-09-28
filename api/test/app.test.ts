import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import type { Services } from '../src/types.js';

let app: FastifyInstance;

beforeAll(async () => {
  const config = loadConfig({
    NODE_ENV: 'test',
    DATABASE_URL: 'postgres://u:p@localhost:5432/db',
    JWT_SECRET: 'x'.repeat(32),
  });
  // Only routes that do not reach the database/docker are exercised here.
  const services = { config } as unknown as Services;
  app = await buildApp(services, { logger: false });
});

afterAll(async () => {
  await app.close();
});

describe('HTTP app', () => {
  it('exposes a health endpoint', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/health' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
  });

  it('requires authentication on protected routes', async () => {
    for (const url of ['/api/sessions/current', '/api/admin/users']) {
      const response = await app.inject({ method: 'GET', url });
      expect(response.statusCode).toBe(401);
      expect(response.json()).toMatchObject({ error: { code: 'UNAUTHORIZED' } });
    }
  });

  it('rejects an invalid session cookie', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/sessions/current',
      cookies: { unciv_session: 'not-a-jwt' },
    });
    expect(response.statusCode).toBe(401);
  });

  it('denies game stream access without a session cookie', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/sessions/authorize',
      headers: { 'x-forwarded-uri': '/play/0f8fad5b-d9cb-469f-a165-70867728950e/vnc.html' },
    });
    expect(response.statusCode).toBe(401);
  });

  it('validates request bodies', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { login: '' },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
  });

  it('returns a JSON 404 for unknown routes', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/unknown' });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ error: { code: 'NOT_FOUND' } });
  });
});
