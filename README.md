# Smart Tea Supply Chain & Traceability Management System

EC5406 Software Group Project · Group 13 · Jira project **ESPTSCMS**

A system for managing the tea supply chain, from producer registration and green-leaf collection to processing and
traceability. This branch contains the **Sprint 1 working prototype**: secure sign-in, role-based access, the producer registry, and
green-leaf weighing with batch IDs and printable receipts.

## Stack
| Part | Tech |
|---|---|
| `client/` | React 19 + Vite, react-router-dom 7, axios, qrcode.react |
| `server/` | Node 20+ / Express 5 (ES modules), PostgreSQL 17 (Neon) via Prisma 7, zod, JWT in an httpOnly cookie, bcryptjs, helmet, express-rate-limit |
| Tests | Vitest + Supertest on real PostgreSQL: embedded-postgres locally (no Docker needed), a service container in CI |
| CI | GitHub Actions: server tests and client lint + build on every pull request |

```
server/
  index.js              boots the app (connect DB + listen)
  src/app.js            Express app (helmet, CORS, cookies, /api/health, /api/v1)
  prisma/schema.prisma  database schema (User, Producer, Field, Collection, GreenLeafBatch, Counter, AuditLog, …)
  prisma/migrations/    SQL migrations, incl. *_db_rules (CHECK constraints, append-only audit_log trigger)
  prisma.config.js      Prisma CLI config (migrations use DIRECT_URL)
  docker-compose.yml    optional local PostgreSQL 17
  src/app.js            Express app (helmet, CORS, cookies, /api/health, /api/v1)
  src/config/           env + the shared PrismaClient (db.js)
  src/rules/            business rules: permissions.js (role matrix), netWeight.js, codes.js (ID formats), enums.js
  src/services/         atomic counters, audit log, transactional collection recording
  src/serializers.js    database rows → API JSON (keeps `_id`, numbers for decimals)
  src/controllers/ routes/ middleware/ validation/
  src/seed/             seed.js (demo data), run.js (npm run seed), memory.js (npm run dev:memory), localPg.js
  src/tests/            unit, API, RBAC and database-rule tests
client/src/
  api/ auth/ layout/ components/ pages/ styles/
docs/                   api.md, DEMO.md, DEPLOYMENT.md
```

## Setup

Requirements: Node 20 or newer, and a PostgreSQL 17 database. Any of these works:
- a **Neon** project (free; see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md#1-postgresql-on-neon)), ideally a separate dev branch,
- **Docker**: `cd server && docker compose up -d` (PostgreSQL 17 on `localhost:5432`, user/password `smarttea`),
- **nothing at all**: `npm run dev:memory` and `npm test` start their own throw-away PostgreSQL.

```bash
# 1. Install (also generates the Prisma client)
cd server && npm install
cd ../client && npm install

# 2. Configure
cp server/.env.example server/.env    # set DATABASE_URL, DIRECT_URL and JWT_SECRET
cp client/.env.example client/.env    # VITE_API_URL=http://localhost:5000/api/v1
```

`server/.env`:

| Variable | Example | Purpose |
|---|---|---|
| `DATABASE_URL` | Neon: `postgresql://user:pass@ep-…-pooler.…neon.tech/smarttea?sslmode=require`<br>Docker: `postgresql://smarttea:smarttea@localhost:5432/smarttea` | connection used by the API (Neon: the **pooled** string) |
| `DIRECT_URL` | Neon: same without `-pooler`<br>Docker: same as `DATABASE_URL` | connection used by `prisma migrate` |
| `DATABASE_URL_TEST` | optional, e.g. `postgresql://smarttea:smarttea@localhost:5432/smarttea_test` | server for `npm test`; unset = embedded PostgreSQL |
| `PORT` | `5000` | API port |
| `JWT_SECRET` | long random string | signs session tokens |
| `JWT_EXPIRES_IN` | `8h` | session length |
| `CLIENT_URL` | `http://localhost:5173` | allowed CORS origin(s), comma-separated |
| `NODE_ENV` | `development` / `production` | `production` turns on `Secure; SameSite=None` cookies |

```bash
# 3. Create the tables, then load demo data (the seed wipes the database!)
cd server && npm run db:deploy && npm run seed

# 4. Run both dev servers (two terminals)
cd server && npm run dev      # http://localhost:5000  (GET /api/health)
cd client && npm run dev      # http://localhost:5173

# Alternatives to steps 3–4 for the API:
cd server && npm run dev:memory   # throw-away embedded PostgreSQL 17, migrated + seeded, nothing saved, no Docker
cd server && npm run dev:local    # Docker PostgreSQL from docker-compose.yml, migrate + seed + dev server

# Database
cd server && npm run db:migrate -- --name what_changed   # after editing prisma/schema.prisma (local DB only)
cd server && npm run db:generate                          # regenerate the Prisma client

# Tests (each test file gets its own schema, migrated and dropped afterwards)
cd server && npm test
cd client && npm run lint && npm run build
```

## Demo accounts
Password for every account: **`Demo@1234`**

| Role | Email | Lands on |
|---|---|---|
| ADM System Administrator | admin@smarttea.lk | User accounts, Users & Roles |
| MGT Management | mgt@smarttea.lk | Today's totals (kg, collections, pending producers) |
| FRM Farmer / Estate Officer | farmer@smarttea.lk | Own deliveries (K. Sunil Jayasinghe, PRD-00417) |
| COL Leaf Collection Officer | col@smarttea.lk | My collections today + Record collection |
| FAC Factory Officer | fac@smarttea.lk | Latest green-leaf batches |
| QO Quality Officer | qo@smarttea.lk | Latest green-leaf batches |
| WH Warehouse Manager | wh@smarttea.lk | Upcoming modules |
| BUY Buyer / Distributor | buyer@smarttea.lk | Upcoming modules (no access to collections) |
| TRN Transporter | trn@smarttea.lk | Upcoming modules |

The seed also loads 3 collection centres (Galaha, Pussellawa, Hantane), 1 producer organisation, 6 producers (5 verified,
1 pending, PRD-00422), 1–3 fields each, the approved green-leaf price (LKR 245/kg) and 10 historical collections with batch IDs.

The step-by-step client demo is in **[docs/DEMO.md](docs/DEMO.md)**.

## Sprint 1 stories covered
| Jira | Story | Where |
|---|---|---|
| ESPTSCMS-15 | US-001 Log in / out with secure sessions: JWT httpOnly cookie, bcrypt, generic error, 15-min lock after 5 failures, deactivated users refused | `controllers/auth.controller.js`, `tests/auth.test.js` |
| ESPTSCMS-16 | US-002 Role-based access on every API route (role + record ownership) and role-filtered navigation | `rules/permissions.js`, `middleware/auth.js`, `tests/rbac.test.js` |
| ESPTSCMS-17 | US-014 Register, list and search producers; MGT verifies or rejects | `controllers/producers.controller.js`, W03/W04/W05 pages |
| ESPTSCMS-20 | US-020 Record collection, net = gross − tare (server side) with validation | `rules/netWeight.js`, M06 page |
| ESPTSCMS-84 | US-022 Unique Green-Leaf Batch ID `GL-YYYY-MM-NNNN`, safe under concurrent requests | `services/counter.js`, `services/collection.service.js` |
| ESPTSCMS-83 | US-021 Collection receipt `RC-NNNNN` with QR code of the batch ID, printable | M07 `pages/Receipt.jsx` |
| ESPTSCMS-145 | Role-based landing pages; MGT totals; "Coming in Sprint N" placeholders | `pages/Dashboard.jsx`, `pages/ComingSoon.jsx` |
| ESPTSCMS-136/146 | One-command seed | `npm run seed` |
| ESPTSCMS-138 | End-to-end skeleton | client ⇄ API ⇄ PostgreSQL (Neon) |
| ESPTSCMS-137 | API documentation | [docs/api.md](docs/api.md) |
| ESPTSCMS-148 | Deployment notes | [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) |

Out of scope for Sprint 1 (shown as placeholders): leaf inspection, processing, finished-tea QC, traceability, inventory, orders,
pricing UI, payments, transport, reports and notifications.

## Workflow
- Work on feature branches and open a pull request to `main`. CI must pass.
- Commit messages start with the Jira key, e.g. `ESPTSCMS-20: net weight calculation`.
- Never commit `.env` files or secrets. Only the `.env.example` files are tracked.
