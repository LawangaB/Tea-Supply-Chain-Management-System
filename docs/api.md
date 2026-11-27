# Smart Tea API – v1 (Sprint 1)

Base URL: `http://localhost:5000/api/v1` (production: `https://<your-api>.onrender.com/api/v1`)

- **Auth:** `POST /auth/login` sets an `httpOnly` cookie `st_session` (JWT, 8 h). Browsers send it automatically
  (`axios` with `withCredentials: true`). For Postman/curl you can also send `Authorization: Bearer <token>`.
- **Body format:** JSON. Every body is validated with zod.
- **Permissions:** every route below `/auth` is checked against the Role & Permission Matrix in
  [`server/src/rules/permissions.js`](../server/src/rules/permissions.js). FRM users get *own* scope: only their own producer
  record and its collections.
- **Time zone:** dates are stored in UTC. "Today", batch months and receipts use Sri Lanka time (Asia/Colombo).

## Error format

Every error has the same shape:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Validation failed",
             "fields": [ { "field": "tareKg", "message": "Tare weight must be less than gross weight" } ] } }
```

| Status | `code` | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Body or field invalid (see `fields`) |
| 401 | `UNAUTHENTICATED`, `INVALID_CREDENTIALS` | No or expired session; wrong email or password (generic message) |
| 403 | `FORBIDDEN`, `ACCOUNT_DEACTIVATED` | Role is not allowed, or the record is not the user's own |
| 404 | `NOT_FOUND` | Unknown id or route |
| 409 | `CONFLICT`, `PRODUCER_NOT_VERIFIED` | Duplicate (email, NIC…), wrong state (already verified), collecting from an unverified producer |
| 423 | `ACCOUNT_LOCKED` | 5 failed logins → locked for 15 min |
| 429 | `RATE_LIMITED` | More than 50 login attempts per IP per 15 min |

## Endpoints

### Health
| Method | Path | Who | Notes |
|---|---|---|---|
| GET | `/api/health` | public | `{ "status": "ok" }` (note: not under `/v1`) |

### Auth – US-001 (ESPTSCMS-15)
| Method | Path | Who | Body / response |
|---|---|---|---|
| POST | `/auth/login` | public | `{ email, password }` → `200 { user, permissions, menu, producer }` + cookie |
| POST | `/auth/logout` | anyone | Clears the cookie → `204` |
| GET | `/auth/me` | signed in | `{ user: { id, fullName, email, roles, roleNames }, permissions: [action], menu: [{ key, label, path, comingInSprint? }], producer }` (`producer` = the FRM user's own producer, else `null`) |

### Lookups
| GET | `/lookups` | signed in | `{ centres, orgs, roles }` for forms |
|---|---|---|---|

### Users – ADM only
| Method | Path | Body |
|---|---|---|
| GET | `/users?q=&role=&status=` | – |
| POST | `/users` | `{ fullName, email, phone?, password, roles: ["COL", ...] }` – password ≥ 8 chars with upper case, lower case and a digit |
| PATCH | `/users/:id` | any of `{ fullName, phone, password, roles, status: "ACTIVE"\|"DEACTIVATED" }`. Reactivating also clears a lockout. An admin can't deactivate themselves or remove their own ADM role (409). |

### Producers – US-014 (ESPTSCMS-17)
| Method | Path | Who | Notes |
|---|---|---|---|
| GET | `/producers?q=&status=&type=&centre=&page=&limit=` | MGT, COL, FRM (own) | `q` searches code, name, NIC/reg. no. and phone. Returns `{ items, total, page, limit }` |
| POST | `/producers` | MGT, COL | `{ type: SMALLHOLDER\|ESTATE\|ORG_MEMBER, fullName, nicOrRegNo, phone?, address?, centreId, orgId? (required for ORG_MEMBER), fields?: [{ division?, areaHa, variety?, gps?: {lat,lng} }] }` → `201`, status **PENDING**, code `PRD-NNNNN`, field codes `F-NNNNN-A…`. Non-estates need a valid NIC (`851234567V` / `198512345678`). Duplicate NIC → 409. |
| GET | `/producers/:id` | MGT, COL, FRM (own) | Producer + `fields` + `collections: { count, totalNetKg, lastCollectedAt }` |
| POST | `/producers/:id/verify` | MGT | US-015: only from PENDING → `VERIFIED` (409 if already verified or rejected). Status change and `PRODUCER_VERIFIED` audit entry are one transaction; of two simultaneous decisions exactly one succeeds, the other gets 409. |
| POST | `/producers/:id/reject` | MGT | `{ reason }` (3–300 chars). Only from PENDING → `REJECTED`; the reason is returned as `rejectionReason` on the producer, so officers see it. Audited as `PRODUCER_REJECTED` with the reason. |
| GET | `/producers/:id/fields` | MGT, COL, FRM (own) | `{ items, total }` |
| POST | `/producers/:id/fields` | MGT, COL, FRM (own) | `{ division?, areaHa, variety?, gps? }` (area rounded to 3 dp). Rejected producer → 409. |
| GET | `/fields?q=&producerId=&status=ACTIVE\|INACTIVE&page=&limit=` | MGT, COL, FRM (own) | US-016 field search: `q` matches field code, division, variety, producer code/name. FRM only ever gets their own fields. `{ items: [field + producer: { _id, code, fullName }], total, page, limit }` |
| GET | `/fields/:id` | MGT, COL, FRM (own) | One field + producer. Another farmer's field → 403. |
| PATCH | `/fields/:id` | MGT, FRM (own) | US-016 edit: any of `{ division?, areaHa?, variety?, gps?: {lat,lng}\|null, status?: ACTIVE\|INACTIVE }`. `gps: null` clears the location; fields are deactivated, never deleted. COL can view but not edit (403). Audited as `FIELD_UPDATED` / `FIELD_DEACTIVATED` / `FIELD_REACTIVATED`. |

### Collections – US-020/021/022 (ESPTSCMS-20, -83, -84)
| Method | Path | Who | Notes |
|---|---|---|---|
| POST | `/collections` | COL | `{ producerId, fieldId, grossKg, tareKg, collectedAt? }` → `201` receipt (below) |
| GET | `/collections?q=&producerId=&today=true&mine=true&from=&to=&page=&limit=` | ADM, MGT, COL, FAC, QO, FRM (own) | `{ items, total, totalNetKg, page, limit }`. `batchCode` is omitted for roles that can't view batch IDs (FRM). |
| GET | `/collections/:id/receipt` | MGT, COL, FRM (own) | Receipt (below) |

Rules for `POST /collections`:
- `netKg = grossKg − tareKg` is computed **on the server** (a `netKg` sent by the client is ignored), rounded to 3 dp.
- The request is rejected with field errors when `grossKg ≤ 0`, `tareKg < 0`, `tareKg ≥ grossKg`, or either value is not a JSON
  number (strings such as `"438"` are refused). `collectedAt` can't be in the future.
- The producer must be **VERIFIED** (409 `PRODUCER_NOT_VERIFIED`), and the field must belong to it and be active.
- Weights are stored at gram precision (3 dp); the database also enforces `net_kg = round(gross_kg − tare_kg, 3)`,
  `0 < gross_kg ≤ 10000` and `0 ≤ tare_kg < gross_kg` with CHECK constraints.
- One PostgreSQL transaction does all of the following: it takes the next receipt number `RC-NNNNN` and the next batch ID
  `GL-YYYY-MM-NNNN` (an atomic `INSERT … ON CONFLICT DO UPDATE … RETURNING` counter per month, plus unique constraints), and
  creates the `Collection` and its `GreenLeafBatch` (status `IN_TRANSIT`). It also stores the APPROVED green-leaf price version
  used and writes an `AuditLog` entry. If any step fails, nothing is saved and the numbers are not used up (no gaps).

Receipt shape:

```json
{ "id": "…", "receiptNo": "RC-00011", "batchCode": "GL-2026-11-0006", "batchStatus": "IN_TRANSIT",
  "producer": { "id": "…", "code": "PRD-00417", "fullName": "K. Sunil Jayasinghe", "type": "SMALLHOLDER" },
  "field": { "id": "…", "code": "F-00417-B", "division": "Upper slope" },
  "centre": { "code": "GAL", "name": "Galaha" }, "collector": { "id": "…", "fullName": "Pradeep Kumara" },
  "collectedAt": "2026-11-06T03:15:00.000Z", "grossKg": 438, "tareKg": 26, "netKg": 412 }
```

### Dashboard – ESPTSCMS-145
| GET | `/dashboard/today` | MGT | `{ date, totalNetKg, collectionsCount, producersSupplied, pendingProducers, verifiedProducers, byCentre: [{ centre, netKg, count }], recent: [...] }` |
|---|---|---|---|

## Data model (PostgreSQL / Prisma)

`User` (table `app_user`), `CollectionCentre`, `ProducerOrg`, `Producer`, `Field`, `PriceVersion`, `Collection`, `GreenLeafBatch`,
`Counter`, `AuditLog`. The schema is [`server/prisma/schema.prisma`](../server/prisma/schema.prisma) and follows the ERD:
UUID primary keys, foreign keys for every reference, Postgres enums for roles and statuses. `GreenLeafBatch.collectionId` is a
unique 1:1 link to its `Collection`. Business rules the database enforces itself (CHECK constraints, append-only audit log) are
in [`migrations/*_db_rules`](../server/prisma/migrations).

Ids are UUID strings. Responses keep the shapes of the first version: producers, fields, users, centres and organisations carry
their id as **`_id`**, while collections and receipts use **`id`**. A malformed id in a URL returns 404. `AuditLog` is append-only:
it has no routes, and a database trigger refuses `UPDATE` and `DELETE`.

Audited actions: `LOGIN_SUCCESS`, `LOGIN_FAILED`, `LOGIN_BLOCKED`, `LOGOUT`, `USER_CREATED`, `USER_UPDATED`, `USER_ROLES_CHANGED`,
`USER_DEACTIVATED`, `USER_REACTIVATED`, `PRODUCER_REGISTERED`, `PRODUCER_VERIFIED`, `PRODUCER_REJECTED`, `FIELD_CREATED`, `COLLECTION_CREATED`.
