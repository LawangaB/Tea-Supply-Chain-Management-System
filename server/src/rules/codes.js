/** Business identifiers. Sequence numbers come from the Counter collection (services/counter.js). */
export const TIMEZONE = 'Asia/Colombo';

/** {year, month, day} of a date in Sri Lanka time (strings, zero-padded). */
export function localParts(date = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date).map((p) => [p.type, p.value]));
  return { year: parts.year, month: parts.month, day: parts.day };
}

/** Counter key for the per-month batch sequence, e.g. "GL-2026-11". */
export function batchCounterKey(date = new Date()) {
  const { year, month } = localParts(date);
  return `GL-${year}-${month}`;
}

export const BATCH_CODE_RE = /^GL-\d{4}-(0[1-9]|1[0-2])-\d{4,}$/;
export const RECEIPT_NO_RE = /^RC-\d{5,}$/;
export const PRODUCER_CODE_RE = /^PRD-\d{5,}$/;

/** GL-YYYY-MM-NNNN */
export const formatBatchCode = (date, seq) => `${batchCounterKey(date)}-${String(seq).padStart(4, '0')}`;
/** RC-NNNNN */
export const formatReceiptNo = (seq) => `RC-${String(seq).padStart(5, '0')}`;
/** PRD-NNNNN */
export const formatProducerCode = (seq) => `PRD-${String(seq).padStart(5, '0')}`;

/** Start and end (exclusive) of "today" in Sri Lanka time, as Date objects. */
export function todayRange(now = new Date()) {
  const { year, month, day } = localParts(now);
  const start = new Date(`${year}-${month}-${day}T00:00:00+05:30`);
  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
}
