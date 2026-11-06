# Deployment notes (ESPTSCMS-148) – free tier

Architecture: **MongoDB Atlas** (M0 free) ← **Render** web service (Express API) ← **Vercel or Netlify** (static React build).

## 1. MongoDB Atlas
1. **Database Access:** create a user with a strong password, role *Read and write to any database*.
   Never commit this password. If it was ever pushed to GitHub, change it.
2. **Network Access:** Render's free tier has no fixed outbound IPs, so add `0.0.0.0/0` (allow from anywhere).
   The protection then comes from the strong password and TLS. For local development, also add your own IP; Atlas rejects
   unknown IPs with a TLS *"alert internal error"*.
3. Copy the `mongodb+srv://…` string and add the database name: `…mongodb.net/smarttea?retryWrites=true&w=majority`.
   (If the string has no database name, the API uses `smarttea`.)
4. Atlas clusters are replica sets, so the transactions used for collections work out of the box.

## 2. API on Render
New → **Web Service** → connect the GitHub repo.

| Setting | Value |
|---|---|
| Root directory | `server` |
| Build command | `npm ci` |
| Start command | `npm start` |
| Health check path | `/api/health` |
| Instance type | Free |

Environment variables:

| Key | Value |
|---|---|
| `MONGODB_URI` | the Atlas string from step 1 |
| `JWT_SECRET` | a long random string: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` |
| `JWT_EXPIRES_IN` | `8h` |
| `CLIENT_URL` | the exact client origin, e.g. `https://smart-tea.vercel.app` (no trailing slash; comma-separate several) |
| `NODE_ENV` | `production` |

With `NODE_ENV=production`, the session cookie is sent with `Secure; SameSite=None; HttpOnly`. That's required because the client
and the API are on different domains over HTTPS. The API trusts Render's proxy (`trust proxy`), so secure cookies and
rate limiting by client IP work. CORS only allows `CLIENT_URL`, with credentials.

**Seeding production once:** in the Render dashboard, open **Shell** and run `SEED_CONFIRM=yes npm run seed`.
The seed script refuses to wipe a production database without `SEED_CONFIRM=yes`.

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

## Security checklist
- [ ] Atlas password changed if it was ever committed; `.env` files are not in git (`git ls-files | grep .env` shows only the `.env.example` files)
- [ ] `JWT_SECRET` is unique per environment
- [ ] Demo accounts (`Demo@1234`) are removed or have their passwords changed before any real data is entered
