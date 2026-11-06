import { describe, it, expect } from 'vitest';
import { computeNetKg, weightErrors, WeightError } from '../rules/netWeight.js';
import { formatBatchCode, batchCounterKey, BATCH_CODE_RE, formatReceiptNo, RECEIPT_NO_RE, formatProducerCode, todayRange } from '../rules/codes.js';
import { scopeFor, can, menuFor, PERMISSIONS, ROLE_CODES } from '../rules/permissions.js';

describe('net weight rule (ESPTSCMS-20)', () => {
  it('computes net = gross - tare: 438 - 26 = 412', () => {
    expect(computeNetKg(438, 26)).toBe(412);
    expect(computeNetKg(438.0, 26.0)).toBe(412.0);
  });

  it('removes floating-point noise', () => {
    expect(computeNetKg(0.3, 0.1)).toBe(0.2);
    expect(computeNetKg(64.0, 3.5)).toBe(60.5);
  });

  it.each([
    ['gross 0', 0, 0, 'grossKg'],
    ['negative gross', -5, 0, 'grossKg'],
    ['negative tare', 100, -1, 'tareKg'],
    ['tare equal to gross', 50, 50, 'tareKg'],
    ['tare greater than gross', 50, 60, 'tareKg'],
    ['text gross', 'abc', 2, 'grossKg'],
    ['numeric string gross', '438', 26, 'grossKg'],
    ['text tare', 100, 'x', 'tareKg'],
    ['missing values', undefined, null, 'grossKg'],
    ['NaN', Number.NaN, 1, 'grossKg'],
    ['Infinity', Number.POSITIVE_INFINITY, 1, 'grossKg'],
  ])('rejects %s', (_, gross, tare, field) => {
    expect(() => computeNetKg(gross, tare)).toThrow(WeightError);
    expect(weightErrors(gross, tare).map((e) => e.field)).toContain(field);
  });

  it('allows tare of 0', () => {
    expect(computeNetKg(10, 0)).toBe(10);
  });
});

describe('identifier formats (ESPTSCMS-84 / 83)', () => {
  it('formats batch codes as GL-YYYY-MM-NNNN in Sri Lanka time', () => {
    const d = new Date('2026-11-06T08:00:00+05:30');
    expect(formatBatchCode(d, 1)).toBe('GL-2026-11-0001');
    expect(formatBatchCode(d, 1234)).toBe('GL-2026-11-1234');
    expect(BATCH_CODE_RE.test(formatBatchCode(d, 7))).toBe(true);
  });

  it('uses the local month at the month boundary (UTC still previous month)', () => {
    // 1 Nov 00:30 in Colombo = 31 Oct 19:00 UTC
    expect(batchCounterKey(new Date('2026-10-31T19:00:00Z'))).toBe('GL-2026-11');
  });

  it('formats receipt and producer numbers', () => {
    expect(formatReceiptNo(42)).toBe('RC-00042');
    expect(RECEIPT_NO_RE.test(formatReceiptNo(42))).toBe(true);
    expect(formatProducerCode(417)).toBe('PRD-00417');
  });

  it('computes today as a 24h window starting at local midnight', () => {
    const { start, end } = todayRange(new Date('2026-11-06T10:00:00+05:30'));
    expect(start.toISOString()).toBe('2026-11-05T18:30:00.000Z');
    expect(end - start).toBe(86400000);
  });
});

describe('permission matrix (ESPTSCMS-16)', () => {
  it('matches the client-approved Sprint 1 matrix', () => {
    expect(can(['COL'], 'collection:create')).toBe(true);
    expect(can(['BUY'], 'collection:create')).toBe(false);
    expect(can(['BUY'], 'collection:read')).toBe(false);
    expect(scopeFor(['FRM'], 'collection:read')).toBe('own');
    expect(scopeFor(['FRM'], 'producer:read')).toBe('own');
    expect(can(['FRM'], 'batch:read')).toBe(false);
    expect(ROLE_CODES.filter((r) => can([r], 'producer:verify'))).toEqual(['MGT']);
    expect(ROLE_CODES.filter((r) => can([r], 'dashboard:read'))).toEqual(['MGT']);
    expect(ROLE_CODES.filter((r) => can([r], 'user:create'))).toEqual(['ADM']);
    expect(ROLE_CODES.filter((r) => can([r], 'producer:create')).sort()).toEqual(['COL', 'MGT']);
  });

  it('gives a multi-role user the union, with "all" beating "own"', () => {
    expect(scopeFor(['FRM', 'MGT'], 'collection:read')).toBe('all');
    expect(can(['FRM', 'COL'], 'collection:create')).toBe(true);
    expect(scopeFor([], 'collection:read')).toBe(null);
  });

  it('throws on unknown actions', () => {
    expect(() => scopeFor(['ADM'], 'nope')).toThrow();
  });

  it('builds a role-filtered menu', () => {
    const buy = menuFor(['BUY']).map((m) => m.key);
    expect(buy).not.toContain('collections');
    expect(buy).not.toContain('producers');
    expect(buy).toContain('dashboard');
    const col = menuFor(['COL']).map((m) => m.key);
    expect(col).toEqual(expect.arrayContaining(['producers', 'collections']));
    expect(menuFor(['ADM']).map((m) => m.key)).toContain('users');
    expect(menuFor(['MGT']).find((m) => m.key === 'processing').comingInSprint).toBeGreaterThan(1);
  });

  it('every role code in the matrix is a known role', () => {
    for (const rule of Object.values(PERMISSIONS)) {
      for (const r of Object.keys(rule)) expect(ROLE_CODES).toContain(r);
    }
  });
});
