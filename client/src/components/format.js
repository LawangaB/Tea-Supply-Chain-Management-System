const TZ = 'Asia/Colombo';

export const kg = (n, digits = 1) => (n == null || Number.isNaN(n)
  ? '—'
  : `${Number(n).toLocaleString('en-LK', { minimumFractionDigits: digits, maximumFractionDigits: 3 })} kg`);

export const num = (n) => (n == null ? '—' : Number(n).toLocaleString('en-LK'));

export const dateTime = (d) => (d
  ? new Date(d).toLocaleString('en-GB', { timeZone: TZ, day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  : '—');

export const date = (d) => (d
  ? new Date(d).toLocaleDateString('en-GB', { timeZone: TZ, day: '2-digit', month: 'short', year: 'numeric' })
  : '—');

export const time = (d) => (d ? new Date(d).toLocaleTimeString('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }) : '—');

export const initials = (name = '') => name.split(/\s+/).filter((w) => /[A-Za-z]/.test(w[0])).slice(-2).map((w) => w[0]).join('').toUpperCase();

export const TYPE_LABEL = { SMALLHOLDER: 'Smallholder', ESTATE: 'Estate', ORG_MEMBER: 'Producer-org member' };
