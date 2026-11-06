import { describe, it, expect, beforeAll } from 'vitest';
import { app, request, useSeededDb, loginAs } from './helpers.js';
import { ROLE_CODES, can } from '../rules/permissions.js';

useSeededDb();

// A valid ObjectId that does not exist: allowed roles get 404/400, denied roles get 403.
const MISSING = '0123456789abcdef01234567';

/** Every protected route and the matrix action that guards it. */
const ROUTES = [
  ['get', '/api/v1/users', 'user:read'],
  ['post', '/api/v1/users', 'user:create'],
  ['patch', `/api/v1/users/${MISSING}`, 'user:update'],
  ['get', '/api/v1/producers', 'producer:read'],
  ['post', '/api/v1/producers', 'producer:create'],
  ['get', `/api/v1/producers/${MISSING}`, 'producer:read'],
  ['post', `/api/v1/producers/${MISSING}/verify`, 'producer:verify'],
  ['post', `/api/v1/producers/${MISSING}/reject`, 'producer:verify'],
  ['get', `/api/v1/producers/${MISSING}/fields`, 'producer:read'],
  ['post', `/api/v1/producers/${MISSING}/fields`, 'field:create'],
  ['get', '/api/v1/collections', 'collection:read'],
  ['post', '/api/v1/collections', 'collection:create'],
  ['get', `/api/v1/collections/${MISSING}/receipt`, 'receipt:read'],
  ['get', '/api/v1/dashboard/today', 'dashboard:read'],
];

describe('every protected route requires a session (401)', () => {
  it.each(ROUTES)('%s %s', async (method, url) => {
    const res = await request(app)[method](url).send({});
    expect(res.status).toBe(401);
  });
});

describe('every protected route enforces the permission matrix (allow + deny)', () => {
  const agents = {};
  beforeAll(async () => {
    for (const role of ROLE_CODES) agents[role] = await loginAs(role);
  });

  for (const [method, url, action] of ROUTES) {
    for (const role of ROLE_CODES) {
      const allowed = can([role], action);
      it(`${role} ${allowed ? 'is allowed' : 'is denied'}: ${method.toUpperCase()} ${url}`, async () => {
        // Bodies are sent with valid-but-harmless content so allowed roles never mutate data.
        const body = method === 'patch' ? { fullName: 'Nobody' } : {};
        const res = await agents[role][method](url).send(body);
        if (allowed) {
          expect(res.status, JSON.stringify(res.body)).not.toBe(403);
          expect(res.status).not.toBe(401);
          expect([200, 400, 404]).toContain(res.status);
        } else {
          expect(res.status).toBe(403);
          expect(res.body.error.code).toBe('FORBIDDEN');
        }
      });
    }
  }
});

describe('error format', () => {
  it('unknown routes use the standard error shape', async () => {
    const res = await request(app).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { code: 'NOT_FOUND', message: expect.any(String), fields: [] } });
  });

  it('health check stays public', async () => {
    expect((await request(app).get('/api/health')).body).toEqual({ status: 'ok' });
  });
});
