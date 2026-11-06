import { describe, it, expect } from 'vitest';
import User from '../models/User.js';
import AuditLog from '../models/AuditLog.js';
import { app, request, useSeededDb, loginAs, EMAIL } from './helpers.js';
import { DEMO_PASSWORD } from '../seed/seed.js';

useSeededDb();
const login = (email, password) => request(app).post('/api/v1/auth/login').send({ email, password });

describe('POST /auth/login (ESPTSCMS-15)', () => {
  it('signs in with valid credentials and sets an httpOnly cookie', async () => {
    const res = await login(EMAIL.COL, DEMO_PASSWORD);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(EMAIL.COL);
    expect(res.body.user.roles).toEqual(['COL']);
    expect(res.body.permissions).toContain('collection:create');
    expect(res.body.user).not.toHaveProperty('passwordHash');
    const cookie = res.headers['set-cookie'][0];
    expect(cookie).toMatch(/^st_session=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(await AuditLog.exists({ action: 'LOGIN_SUCCESS' })).toBeTruthy();
  });

  it('is case-insensitive on email', async () => {
    expect((await login('COL@SmartTea.lk', DEMO_PASSWORD)).status).toBe(200);
  });

  it('returns the same generic message for a wrong password and an unknown email', async () => {
    const wrong = await login(EMAIL.QO, 'Wrong@1234');
    const unknown = await login('nobody@smarttea.lk', 'Wrong@1234');
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body.error.message).toBe('Invalid email or password');
    expect(unknown.body).toEqual(wrong.body);
    expect(wrong.headers['set-cookie']).toBeUndefined();
  });

  it('returns 400 with field errors for an empty body', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.fields.map((f) => f.field).sort()).toEqual(['email', 'password']);
  });

  it('locks the account for 15 minutes after 5 failed attempts', async () => {
    for (let i = 0; i < 5; i += 1) {
      expect((await login(EMAIL.WH, 'Wrong@1234')).status).toBe(401);
    }
    const locked = await login(EMAIL.WH, DEMO_PASSWORD); // even the right password is refused now
    expect(locked.status).toBe(423);
    expect(locked.body.error.code).toBe('ACCOUNT_LOCKED');
    const user = await User.findOne({ email: EMAIL.WH });
    const minutes = (user.lockedUntil - Date.now()) / 60000;
    expect(minutes).toBeGreaterThan(14);
    expect(minutes).toBeLessThanOrEqual(15);

    // After the lock expires the right password works again.
    await User.updateOne({ _id: user._id }, { lockedUntil: new Date(Date.now() - 1000) });
    expect((await login(EMAIL.WH, DEMO_PASSWORD)).status).toBe(200);
  });

  it('resets the failure counter after a successful login', async () => {
    for (let i = 0; i < 4; i += 1) await login(EMAIL.FAC, 'Wrong@1234');
    expect((await login(EMAIL.FAC, DEMO_PASSWORD)).status).toBe(200);
    expect((await User.findOne({ email: EMAIL.FAC })).failedLogins).toBe(0);
  });

  it('refuses deactivated users', async () => {
    await User.updateOne({ email: EMAIL.TRN }, { status: 'DEACTIVATED' });
    const res = await login(EMAIL.TRN, DEMO_PASSWORD);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ACCOUNT_DEACTIVATED');
    expect(res.headers['set-cookie']).toBeUndefined();
    await User.updateOne({ email: EMAIL.TRN }, { status: 'ACTIVE' });
  });
});

describe('session', () => {
  it('GET /auth/me returns roles and the role-filtered menu', async () => {
    const agent = await loginAs('BUY');
    const res = await agent.get('/api/v1/auth/me');
    expect(res.status).toBe(200);
    expect(res.body.user.roles).toEqual(['BUY']);
    const keys = res.body.menu.map((m) => m.key);
    expect(keys).not.toContain('collections');
    expect(keys).toContain('orders');
  });

  it('GET /auth/me for FRM includes the linked producer', async () => {
    const res = await (await loginAs('FRM')).get('/api/v1/auth/me');
    expect(res.body.producer.code).toBe('PRD-00417');
  });

  it('GET /auth/me without a session is 401', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('logout clears the cookie and ends the session', async () => {
    const agent = await loginAs('MGT');
    const out = await agent.post('/api/v1/auth/logout');
    expect(out.status).toBe(204);
    expect(out.headers['set-cookie'][0]).toMatch(/st_session=;/);
    expect((await agent.get('/api/v1/auth/me')).status).toBe(401);
  });

  it('a deactivated user loses access immediately, even with a valid cookie', async () => {
    const agent = await loginAs('QO');
    await User.updateOne({ email: EMAIL.QO }, { status: 'DEACTIVATED' });
    expect((await agent.get('/api/v1/auth/me')).status).toBe(401);
    await User.updateOne({ email: EMAIL.QO }, { status: 'ACTIVE' });
  });

  it('rejects a tampered token', async () => {
    const res = await request(app).get('/api/v1/auth/me').set('Cookie', 'st_session=abc.def.ghi');
    expect(res.status).toBe(401);
  });
});

describe('user administration (ADM)', () => {
  it('ADM creates a user, assigns roles and deactivates them', async () => {
    const adm = await loginAs('ADM');
    const created = await adm.post('/api/v1/users').send({
      fullName: 'New Collector', email: 'new.col@smarttea.lk', password: 'Strong@123', roles: ['COL', 'FRM'],
    });
    expect(created.status).toBe(201);
    expect(created.body).not.toHaveProperty('passwordHash');

    const dup = await adm.post('/api/v1/users').send({
      fullName: 'Dup', email: 'new.col@smarttea.lk', password: 'Strong@123', roles: ['COL'],
    });
    expect(dup.status).toBe(409);

    const weak = await adm.post('/api/v1/users').send({ fullName: 'Weak', email: 'w@smarttea.lk', password: 'abc', roles: [] });
    expect(weak.status).toBe(400);
    expect(weak.body.error.fields.map((f) => f.field)).toEqual(expect.arrayContaining(['password', 'roles']));

    const off = await adm.patch(`/api/v1/users/${created.body._id}`).send({ status: 'DEACTIVATED' });
    expect(off.status).toBe(200);
    expect((await login('new.col@smarttea.lk', 'Strong@123')).status).toBe(403);
    expect(await AuditLog.exists({ action: 'USER_DEACTIVATED' })).toBeTruthy();
  });

  it('ADM cannot deactivate themselves', async () => {
    const adm = await loginAs('ADM');
    const me = (await adm.get('/api/v1/auth/me')).body.user;
    const res = await adm.patch(`/api/v1/users/${me.id}`).send({ status: 'DEACTIVATED' });
    expect(res.status).toBe(409);
  });
});
