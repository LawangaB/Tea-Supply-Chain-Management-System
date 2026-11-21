/**
 * Demo data (ESPTSCMS-136/146). Wipes every table and reloads.
 * Used by `npm run seed` (src/seed/run.js), `npm run dev:memory` and by the test suite.
 * The schema must already be migrated (`npm run db:deploy`).
 */
import bcrypt from 'bcryptjs';
import { prisma } from '../config/db.js';
import { recordCollection } from '../services/collection.service.js';

export const DEMO_PASSWORD = 'Demo@1234';

export const DEMO_USERS = [
  { key: 'ADM', fullName: 'Nadeesha Wijesinghe', email: 'admin@smarttea.lk', roles: ['ADM'] },
  { key: 'MGT', fullName: 'Ruwan Senanayake', email: 'mgt@smarttea.lk', roles: ['MGT'] },
  { key: 'FRM', fullName: 'K. Sunil Jayasinghe', email: 'farmer@smarttea.lk', roles: ['FRM'] },
  { key: 'COL', fullName: 'Pradeep Kumara', email: 'col@smarttea.lk', roles: ['COL'] },
  { key: 'FAC', fullName: 'Chaminda Rathnayake', email: 'fac@smarttea.lk', roles: ['FAC'] },
  { key: 'QO', fullName: 'Dilini Fernando', email: 'qo@smarttea.lk', roles: ['QO'] },
  { key: 'WH', fullName: 'Asanka Gunawardena', email: 'wh@smarttea.lk', roles: ['WH'] },
  { key: 'BUY', fullName: 'Ceylon Leaf Traders (Pvt) Ltd', email: 'buyer@smarttea.lk', roles: ['BUY'] },
  { key: 'TRN', fullName: 'Mahesh Transport Services', email: 'trn@smarttea.lk', roles: ['TRN'] },
];

const CENTRES = [
  { code: 'GAL', name: 'Galaha', district: 'Kandy' },
  { code: 'PUS', name: 'Pussellawa', district: 'Kandy' },
  { code: 'HAN', name: 'Hantane', district: 'Kandy' },
];

const PRODUCERS = [
  { code: 'PRD-00417', type: 'SMALLHOLDER', fullName: 'K. Sunil Jayasinghe', nicOrRegNo: '197812345678', phone: '0771234567',
    address: 'No. 12, Deltota Road, Galaha', centre: 'GAL', farmer: true, status: 'VERIFIED',
    fields: [{ division: 'Home garden', areaHa: 0.8, variety: 'TRI 2025' }, { division: 'Upper slope', areaHa: 1.25, variety: 'TRI 4042' }] },
  { code: 'PRD-00418', type: 'ORG_MEMBER', fullName: 'W. M. Kamala Herath', nicOrRegNo: '826543210V', phone: '0712345678',
    address: 'Nillamba, Galaha', centre: 'GAL', org: true, status: 'VERIFIED',
    fields: [{ division: 'Nillamba', areaHa: 0.6, variety: 'TRI 2026' }] },
  { code: 'PRD-00419', type: 'ESTATE', fullName: 'Delta Estate (Pvt) Ltd', nicOrRegNo: 'PV-00219-EST', phone: '0812345678',
    address: 'Delta Estate, Pussellawa', centre: 'PUS', status: 'VERIFIED',
    fields: [{ division: 'Upper Division', areaHa: 42.5, variety: 'TRI 2043' }, { division: 'Lower Division', areaHa: 38.75, variety: 'TRI 3025' }, { division: 'Factory Division', areaHa: 12.125, variety: 'Seedling' }] },
  { code: 'PRD-00420', type: 'SMALLHOLDER', fullName: 'R. A. Nimal Perera', nicOrRegNo: '196923456789', phone: '0761234567',
    address: 'Hantane Road, Kandy', centre: 'HAN', status: 'VERIFIED',
    fields: [{ division: 'Main block', areaHa: 1.5, variety: 'TRI 2025' }] },
  { code: 'PRD-00421', type: 'ORG_MEMBER', fullName: 'S. Thilini Rajapaksha', nicOrRegNo: '199034567890', phone: '0751234567',
    address: 'Watagoda, Pussellawa', centre: 'PUS', org: true, status: 'VERIFIED',
    fields: [{ division: 'Watagoda', areaHa: 0.9, variety: 'TRI 4042' }, { division: 'Stream side', areaHa: 0.4, variety: 'TRI 2025' }] },
  { code: 'PRD-00422', type: 'SMALLHOLDER', fullName: 'M. Ruwan Bandara', nicOrRegNo: '885432109V', phone: '0779876543',
    address: 'Uduwela, Hantane', centre: 'HAN', status: 'PENDING',
    fields: [{ division: 'Uduwela', areaHa: 0.7, variety: 'TRI 2026' }] },
];

// [days ago, hour (local), producer code, field index, gross, tare]
const HISTORY = [
  [20, 8, 'PRD-00419', 0, 1260.5, 48.0],
  [16, 9, 'PRD-00417', 0, 64.0, 3.5],
  [12, 10, 'PRD-00418', 0, 41.2, 2.0],
  [9, 8, 'PRD-00420', 0, 88.6, 4.1],
  [6, 9, 'PRD-00419', 1, 980.0, 40.5],
  [4, 11, 'PRD-00421', 0, 52.3, 2.8],
  [2, 8, 'PRD-00417', 1, 112.4, 5.0],
  [1, 9, 'PRD-00419', 2, 455.0, 22.5],
  [0, 7, 'PRD-00418', 0, 38.7, 1.9],
  [0, 8, 'PRD-00420', 0, 76.2, 3.6],
];

function atLocal(daysAgo, hour) {
  // Sri Lanka is UTC+05:30 all year.
  const d = new Date(Date.now() - daysAgo * 86400000);
  const ymd = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Colombo' }).format(d);
  const at = new Date(`${ymd}T${String(hour).padStart(2, '0')}:00:00+05:30`);
  return at > new Date() ? new Date(Date.now() - 5 * 60000) : at; // never in the future
}

/**
 * Every table in prisma/schema.prisma (one TRUNCATE, so order does not matter). TRUNCATE does not fire the
 * append-only UPDATE/DELETE triggers (audit_log, stock_movement, …). Add new tables here when the schema grows.
 */
const TABLES = [
  // M1 admin & security
  'app_user', 'permission', 'role_permission', 'user_session', 'system_setting', 'audit_log', 'system_log',
  'backup_run', 'notification', 'alert_rule',
  // master data
  'unit', 'tea_grade', 'inspection_parameter', 'tolerance', 'traceability_field_setting',
  // M2 / M3 supply
  'collection_centre', 'producer_org', 'producer', 'field', 'harvest', 'collection_route', 'collection_request',
  'price_version', 'collection', 'green_leaf_batch', 'factory', 'factory_receipt',
  // M4–M7 quality, processing, traceability
  'quality_inspection', 'inspection_result', 'rejected_batch_exception', 'processing_batch', 'processing_input',
  'processing_stage', 'processing_reconciliation', 'finished_tea_batch', 'finished_batch_source',
  'batch_release_event', 'qr_code', 'traceability_issue',
  // M8 warehouse
  'warehouse', 'warehouse_area', 'storage_location', 'stock_balance', 'stock_movement', 'stock_adjustment',
  'stock_count', 'stock_count_line', 'low_stock_threshold',
  // M9 / M11 / M12 sales, payments, transport
  'buyer', 'product', 'product_batch', 'sales_order', 'order_line', 'order_allocation', 'order_status_history',
  'invoice', 'invoice_payment', 'payment_adjustment_rule', 'farmer_payment', 'farmer_payment_line',
  'farmer_payment_adjustment', 'transporter', 'vehicle', 'driver', 'transport_job', 'transport_job_event',
  'proof_of_delivery',
  'counter',
];

export async function wipe() {
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${TABLES.map((t) => `"${t}"`).join(', ')} CASCADE`);
}

/** Wipes and loads demo data. Returns handy references (used by tests). */
export async function seed({ log = () => {} } = {}) {
  if (!prisma) throw new Error('Connect to PostgreSQL before seeding');
  await wipe();
  log('Wiped existing data');

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const users = {};
  for (const u of DEMO_USERS) {
    const { key, ...data } = u;
    users[key] = await prisma.user.create({ data: { ...data, phone: '0770000000', passwordHash } });
  }
  log(`Users: ${DEMO_USERS.length} (password ${DEMO_PASSWORD})`);

  const centres = {};
  for (const c of CENTRES) centres[c.code] = await prisma.collectionCentre.create({ data: c });
  const org = await prisma.producerOrg.create({ data: { regNo: 'TSHDS/KY/0107', name: "Galaha Tea Smallholders' Development Society" } });
  const price = await prisma.priceVersion.create({
    data: {
      priceType: 'PURCHASE_GL', version: 1, pricePerKg: 245, currency: 'LKR',
      effectiveFrom: new Date('2026-01-01T00:00:00+05:30'), status: 'APPROVED',
    },
  });
  log('Centres: 3, producer org: 1, green-leaf price: LKR 245/kg (v1, APPROVED)');

  const producers = {};
  const fields = {};
  for (const p of PRODUCERS) {
    const producer = await prisma.producer.create({
      data: {
        code: p.code, type: p.type, fullName: p.fullName, nicOrRegNo: p.nicOrRegNo, phone: p.phone, address: p.address,
        centreId: centres[p.centre].id, orgId: p.org ? org.id : null, userId: p.farmer ? users.FRM.id : null,
        verificationStatus: p.status, registeredById: users.COL.id,
        verifiedById: p.status === 'VERIFIED' ? users.MGT.id : null,
        verifiedAt: p.status === 'VERIFIED' ? new Date() : null,
      },
    });
    producers[p.code] = producer;
    const digits = p.code.slice(4);
    fields[p.code] = [];
    for (const [i, f] of p.fields.entries()) {
      fields[p.code].push(await prisma.field.create({
        data: { ...f, producerId: producer.id, code: `F-${digits}-${String.fromCharCode(65 + i)}` },
      }));
    }
    await prisma.counter.create({ data: { id: `F-${digits}`, seq: p.fields.length } });
  }
  await prisma.counter.create({ data: { id: 'PRD', seq: 422 } });
  log(`Producers: ${PRODUCERS.length} (${PRODUCERS.filter((p) => p.status === 'PENDING').length} pending)`);

  const req = { user: { id: users.COL.id }, ip: 'seed' };
  for (const [daysAgo, hour, code, fi, grossKg, tareKg] of HISTORY) {
    await recordCollection({ req, producer: producers[code], field: fields[code][fi], grossKg, tareKg, collectedAt: atLocal(daysAgo, hour) });
  }
  log(`Collections: ${HISTORY.length} with green-leaf batch IDs`);

  return { users, centres, org, price, producers, fields };
}
