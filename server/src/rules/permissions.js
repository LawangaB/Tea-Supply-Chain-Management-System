/**
 * Role & Permission Matrix v2 (client approved) — Sprint 1 slice.
 * SINGLE SOURCE OF TRUTH: used by the authorize() middleware, GET /auth/me (menu) and the RBAC tests.
 *
 * Each action maps role -> scope:
 *   'all' = any record, 'own' = only records linked to the user's own producer profile (FRM).
 * A user with several roles gets the union; 'all' beats 'own'.
 */
export const ROLES = {
  ADM: 'System Administrator',
  MGT: 'Management',
  FRM: 'Farmer / Estate Officer',
  COL: 'Leaf Collection Officer',
  FAC: 'Factory Officer',
  QO: 'Quality Officer',
  WH: 'Warehouse Manager',
  BUY: 'Buyer / Distributor',
  TRN: 'Transporter',
};
export const ROLE_CODES = Object.keys(ROLES);

export const PERMISSIONS = {
  // Create/deactivate users, assign roles (ADM CRUD)
  'user:read': { ADM: 'all' },
  'user:create': { ADM: 'all' },
  'user:update': { ADM: 'all' },

  // Register producers (MGT CRU, FRM R(own), COL CR)
  'producer:read': { MGT: 'all', COL: 'all', FRM: 'own' },
  'producer:create': { MGT: 'all', COL: 'all' },
  'producer:update': { MGT: 'all' },
  // Fields are registered as part of the producer record (create = MGT, COL)
  'field:create': { MGT: 'all', COL: 'all' },

  // Verify / approve a producer (MGT A)
  'producer:verify': { MGT: 'all' },

  // Record weighing (ADM R, MGT R, FRM R(own), COL CRU, FAC R, QO R)
  'collection:read': { ADM: 'all', MGT: 'all', FRM: 'own', COL: 'all', FAC: 'all', QO: 'all' },
  'collection:create': { COL: 'all' },

  // Issue / view collection receipt (MGT R, FRM R(own), COL CR)
  'receipt:read': { MGT: 'all', FRM: 'own', COL: 'all' },

  // View Green-Leaf Batch IDs
  'batch:read': { ADM: 'all', MGT: 'all', COL: 'all', FAC: 'all', QO: 'all' },

  // Management dashboard (totals)
  'dashboard:read': { MGT: 'all' },
};

/** Returns 'all' | 'own' | null for a set of roles. */
export function scopeFor(roles = [], action) {
  const rule = PERMISSIONS[action];
  if (!rule) throw new Error(`Unknown permission action: ${action}`);
  let scope = null;
  for (const r of roles) {
    if (rule[r] === 'all') return 'all';
    if (rule[r] === 'own') scope = 'own';
  }
  return scope;
}

export const can = (roles, action) => scopeFor(roles, action) !== null;

export function allowedActions(roles = []) {
  return Object.keys(PERMISSIONS).filter((a) => can(roles, a));
}

/**
 * Sidebar menu. Live items are shown when the user holds `permission`.
 * Placeholder items (later sprints) are shown to the roles that will use them.
 */
export const MENU = [
  { key: 'dashboard', label: 'Dashboard', path: '/', always: true },
  { key: 'producers', label: 'Producers', path: '/producers', permission: 'producer:read' },
  { key: 'collections', label: 'Collections', path: '/collections', permission: 'collection:read' },
  { key: 'leaf-quality', label: 'Leaf Quality', path: '/leaf-quality', sprint: 2, roles: ['MGT', 'QO', 'FAC', 'COL'] },
  { key: 'processing', label: 'Processing', path: '/processing', sprint: 3, roles: ['MGT', 'FAC'] },
  { key: 'finished-quality', label: 'Finished Quality', path: '/finished-quality', sprint: 3, roles: ['MGT', 'QO'] },
  { key: 'traceability', label: 'Traceability', path: '/traceability', sprint: 4, roles: ['ADM', 'MGT', 'FAC', 'QO', 'WH', 'BUY'] },
  { key: 'inventory', label: 'Inventory', path: '/inventory', sprint: 4, roles: ['MGT', 'WH'] },
  { key: 'orders', label: 'Orders', path: '/orders', sprint: 5, roles: ['MGT', 'WH', 'BUY'] },
  { key: 'buyers', label: 'Buyers', path: '/buyers', sprint: 5, roles: ['MGT', 'WH'] },
  { key: 'pricing', label: 'Pricing', path: '/pricing', sprint: 2, roles: ['ADM', 'MGT'] },
  { key: 'payments', label: 'Payments', path: '/payments', sprint: 5, roles: ['MGT', 'FRM'] },
  { key: 'transport', label: 'Transport', path: '/transport', sprint: 5, roles: ['MGT', 'WH', 'TRN', 'BUY'] },
  { key: 'reports', label: 'Reports', path: '/reports', sprint: 6, roles: ['ADM', 'MGT'] },
  { key: 'users', label: 'Users & Roles', path: '/users', permission: 'user:read' },
];

export function menuFor(roles = []) {
  return MENU.filter((m) => m.always
    || (m.permission && can(roles, m.permission))
    || (m.roles && m.roles.some((r) => roles.includes(r))))
    .map(({ key, label, path, sprint }) => ({ key, label, path, ...(sprint ? { comingInSprint: sprint } : {}) }));
}
