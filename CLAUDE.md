# Smart Tea – rules for coding agents

Smart Tea Supply Chain & Traceability Management System (Jira project ESPTSCMS). Express 5 + Prisma 7 API in `server/`,
React client in `client/`, PostgreSQL 17 on Neon.

## Database: code-first, schema is the source of truth
- **Read `docs/DATABASE.md` and `server/prisma/schema.prisma` before writing any data-access code.** The schema already
  contains every table for all sprints (US-001 … US-074). Find the existing model for a feature; do not create parallel
  tables, JSON blobs or ad-hoc columns for data that already has a home.
- Use the exact model/field names from `schema.prisma`. Use the enums there (and their copies in `src/rules/enums.js`),
  never string literals that are not enum values.
- If a feature truly needs a schema change: edit `schema.prisma` only, keep new columns optional or defaulted, run
  `npm run db:migrate -- --name <change>` against a **local** database, add CHECK rules as SQL to the generated migration,
  update `src/rules/enums.js` (new enum values) and `TABLES` in `src/seed/seed.js` (new tables). Say so clearly in the PR.
- Never: edit an existing migration, run `prisma migrate dev` / `migrate reset` / `db push` against Neon, write raw DDL in app
  code, or change the database from the Neon console.
- Business rules that span rows (only VERIFIED producers, only RELEASED batches, allocation ≤ available, status transitions)
  go in the service layer inside `prisma.$transaction`. Single-row rules are already CHECK constraints – keep the API
  validation (zod) in step with them so users get field-level errors.
- Weights are kg `Decimal(…,3)`, money `Decimal(…,2)`; copy prices into transactions; never delete records with history
  (deactivate); write an `audit_log` entry for approvals, price/role changes and adjustments (`services/audit.js`).
- Permissions: `src/rules/permissions.js` (Role & Permission Matrix v2) is the single source of truth for `authorize()`.

## Before finishing
- `cd server && npm test` must pass (embedded Postgres, no setup needed).
- Don't change API response shapes used by the client without updating the client.
