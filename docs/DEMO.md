# Sprint 1 demo script (Friday 6 Nov 2026, 1:30 pm)

**Before the demo (about 10 minutes before)**

1. `cd server && npm run seed` (resets the demo data), then run `npm run dev` in `server/` and in `client/`.
   - *No internet / Atlas down?* Run `cd server && npm run dev:memory` instead. It starts an in-memory database that is already seeded.
2. Open http://localhost:5173 in one normal and one private window, so two people can be signed in at the same time.
3. Have a phone, or Chrome DevTools at 390 px wide, ready for step 1.

All demo accounts use the password **`Demo@1234`**. In development builds the sign-in page has one-click demo account buttons.

---

## 1) Leaf Collection Officer records a collection – `col@smarttea.lk`
*Stories: ESPTSCMS-15, -20, -84, -83*

1. Sign in as `col@smarttea.lk`. The landing page shows *My collections today* and a **Record collection** button.
2. Click **Record collection** (phone width).
3. Search **`417`** and pick **K. Sunil Jayasinghe – PRD-00417**.
   - Point out that the PENDING producer (M. Ruwan Bandara) is greyed out: only VERIFIED producers can supply leaf.
4. Choose field **F-00417-B**.
5. Type gross **438.0** and tare **26.0**. The net weight shows **412.0 kg** live while you type.
   - Optional: type a tare of 500 to show the inline error *"Tare weight must be less than gross weight"*. The server
     enforces the same rule.
6. **Save & issue receipt.** The receipt shows `RC-000NN`, the producer, the field, the gross/tare/net weights, the collector, the time, and the
   **Green-Leaf Batch ID `GL-2026-11-NNNN`** with its **QR code**. Click **Print receipt** to show the print layout.

## 2) Management – `mgt@smarttea.lk`
*Stories: ESPTSCMS-145, -17*

1. Sign in as `mgt@smarttea.lk` (in the other window). The dashboard shows today's **kg collected** (it includes the 412 kg just
   recorded), the **number of collections** and **producers pending verification (1)**.
2. Click **Review pending →**, open **M. Ruwan Bandara (PRD-00422)**, check the details and click **Approve**. The status becomes VERIFIED.
3. Return to the dashboard. *Pending verification* now shows **0**.
4. Optional: open *Processing* in the menu to show the **"Coming in Sprint 3"** placeholder.

## 3) Buyer – `buyer@smarttea.lk`
*Story: ESPTSCMS-16*

1. Sign in as `buyer@smarttea.lk`. The menu has **no Producers or Collections**, only Dashboard and the Buyer's future modules.
2. Type `/collections` in the address bar. The page shows **"You don't have access"**.
3. Open `http://localhost:5000/api/v1/collections` in the same browser. It returns **403** `{"error":{"code":"FORBIDDEN",…}}`.

## 4) Farmer – `farmer@smarttea.lk`
*Story: ESPTSCMS-16 (own-record scope)*

1. Sign in as `farmer@smarttea.lk` (K. Sunil Jayasinghe). The landing page shows *My recent leaf deliveries*, including today's 412 kg.
2. **Producers** lists only **PRD-00417**. **Collections** lists only his own deliveries, and he can open his receipts.
3. The API refuses other producers' records (403). The automated tests cover this (`npm test` → *FRM sees only their own collections*).

---

### Questions the client may ask
- **"What if two collectors save at the same moment?"** Batch IDs come from an atomic counter inside a MongoDB transaction, and a
  unique index backs it up. A test fires 20 saves in parallel and checks that the 20 IDs are unique and consecutive.
- **"Can a collector type the net weight?"** No. The server computes it and ignores any value the client sends.
- **"What happens after 5 wrong passwords?"** The account locks for 15 minutes. The error message never reveals whether the
  email exists. Every sign-in is recorded in the audit log.
