# Deployment notes (ESPTSCMS-148) – free tier

Architecture: **Neon** (serverless PostgreSQL, free plan) ← **Render** web service (Express API + Prisma) ← **Vercel or Netlify** (static React build).

## 1. PostgreSQL on Neon
1. Sign in at [neon.tech](https://neon.tech) → **New project**. Choose **PostgreSQL 17** (CI, Docker and the
   embedded test database all use 17) and the region closest to your Render region (e.g. *AWS Singapore* for Render Singapore).
   Name the database `smarttea`.
2. Open **Connect** on the project dashboard. You need **two** connection strings for the same database and role:
   - **Pooled** (the *Connection pooling* toggle **on**; the host contains `-pooler`): the running API uses this one. Neon's
     PgBouncer handles many short connections from the app, which suits Render's free tier.
   - **Direct** (pooling **off**; no `-pooler` in the host): `prisma migrate` uses this one. Migrations need a direct session.
3. Both must end with `?sslmode=require` (Neon refuses unencrypted connections). For example:
   ```
   DATABASE_URL=postgresql://<role>:<password>@ep-xxx-123456-pooler.ap-southeast-1.aws.neon.tech/smarttea?sslmode=require
   DIRECT_URL=postgresql://<role>:<password>@ep-xxx-123456.ap-southeast-1.aws.neon.tech/smarttea?sslmode=require
   ```
4. Never commit these strings. They contain the password. If one is ever pushed to GitHub, reset the role's password in
   Neon (**Roles → Reset password**).
5. Optional: create a Neon **branch** (e.g. `test`) and put its direct string in `DATABASE_URL_TEST` to run `npm test` against
   Neon. Each test file creates and drops its own schema there.

The free plan suspends the database after a few idle minutes. The first query afterwards takes about a second while it wakes up.

## 2. API on Render
New → **Web Service** → connect the GitHub repo.

| Setting | Value |
|---|---|
| Root directory | `server` |
| Build command | `npm ci && npx prisma migrate deploy` |
| Start command | `npm start` |
| Health check path | `/api/health` |
| Instance type | Free |

`npm ci` also runs `prisma generate` (postinstall). `prisma migrate deploy` applies any new migrations from
`server/prisma/migrations` through `DIRECT_URL`. It never resets data and does nothing when the database is up to date.

Environment variables:

| Key | Value |
|---|---|
| `DATABASE_URL` | Neon **pooled** string from step 1 (`-pooler` host, `?sslmode=require`) |
| `DIRECT_URL` | Neon **direct** string from step 1 (used by `prisma migrate deploy` during the build) |
| `JWT_SECRET` | a long random string: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` |
| `JWT_EXPIRES_IN` | `8h` |
| `CLIENT_URL` | the exact client origin, e.g. `https://smart-tea.vercel.app` (no trailing slash; comma-separate several) |
| `NODE_ENV` | `production` |

With `NODE_ENV=production`, the session cookie is sent with `Secure; SameSite=None; HttpOnly`. That's required because the client
and the API are on different domains over HTTPS. The API trusts Render's proxy (`trust proxy`), so secure cookies and
rate limiting by client IP work. CORS only allows `CLIENT_URL`, with credentials.

**Seeding production once** (after the first successful deploy, so the tables exist): either
- in the Render dashboard, open **Shell** and run `SEED_CONFIRM=yes npm run seed`, or
- from your own machine, with the Neon strings in `server/.env`: `cd server && npm run db:deploy && npm run seed`.

The seed **wipes every table** and loads the demo data. It refuses to run with `NODE_ENV=production` unless
`SEED_CONFIRM=yes` is set.

*Free-tier note:* the service sleeps after about 15 minutes of inactivity, and the first request afterwards takes about 30–50 s.
Open the API URL a minute before the demo.

## 3. Client on Vercel (or Netlify)
| Setting | Vercel | Netlify |
|---|---|---|
| Root / base directory | `client` | `client` |
| Build command | `npm run build` | `npm run build` |
| Output directory | `dist` | `client/dist` |
| Env var | `VITE_API_URL=https://<your-api>.onrender.com/api/v1` | same |

SPA routing is already configured: `client/vercel.json` and `client/public/_redirects` send every path to `index.html`, so
refreshing `/collections/…/receipt` works. `VITE_API_URL` is read **at build time**, so redeploy after changing it.

## 4. Smoke test after deploying
1. `https://<api>/api/health` → `{"status":"ok"}`
2. Open the client URL and sign in as `mgt@smarttea.lk`. If sign-in "works" but you bounce straight back to the sign-in page,
   the cookie was blocked. Check that `NODE_ENV=production`, that `CLIENT_URL` exactly matches the browser origin, and that both
   sites use HTTPS.
3. Run through [DEMO.md](DEMO.md).

## 5. Changing the database schema
1. Edit `server/prisma/schema.prisma`.
2. Against a **local** database (Docker or a Neon dev branch, never production), run
   `npm run db:migrate -- --name short_description`. This writes a new folder in `server/prisma/migrations/`.
3. Commit the migration folder together with the code. The next Render deploy applies it (`prisma migrate deploy`).

CHECK constraints and the audit_log trigger are hand-written SQL in `migrations/*_db_rules`. Prisma doesn't model them, so
add any new database rule as SQL in a new migration (`npm run db:migrate -- --create-only --name ...`, then edit the file).

## Security checklist
- [ ] Neon role password reset if a connection string was ever committed; `.env` files are not in git (`git ls-files | grep .env` shows only the `.env.example` files)
- [ ] `JWT_SECRET` is unique per environment
- [ ] Demo accounts (`Demo@1234`) are removed or have their passwords changed before any real data is entered
- [ ] The old MongoDB Atlas cluster and its database user are deleted once Neon is live (the API no longer uses them)
