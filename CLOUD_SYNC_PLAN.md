# GarageLY — Option A Cloud Sync: Migration Plan

**Goal:** Move the desktop app's data layer from local sql.js to Supabase, and build an identical web app on the same Supabase database. A job saved on the desktop at work appears in the web app at home. Login is email + password via Supabase Auth; one account works on both desktop and web, with the licence linked to it.

**Confirmed decisions**
- **Online-first + cached reads.** Full functionality requires a connection. Offline, the apps show the last-loaded data (read-only) and block writes until reconnected. No offline write queue, no conflict resolution. This keeps server-generated integer primary keys and the current schema shape.
- **One Supabase Auth account** (email + password) used on both platforms; the `GRLY-XXXX-XXXX-XXXX` licence links to it.
- **Multi-tenant isolation** via a `garage_id` on every table plus Row Level Security, so each garage only sees its own data.
- Existing licence system must keep working. Dark theme stays `#0f1117` / `#F4A523`.

---

## 1. The key architectural insight

Every React page reaches data through a single object, `api`, imported from `src/lib/api.ts`. Today that object is just `window.api` — a thin bridge over ~40 Electron IPC calls (`electron/preload.ts` → `electron/ipc.ts` → `electron/database.ts`, sql.js).

That single file is the entire migration seam. If `src/lib/api.ts` is rewritten to talk to Supabase directly (via `supabase-js`), then **the exact same React pages and components run unchanged on both desktop and web**. The Electron renderer is a browser context, so `supabase-js` works there too — the desktop renderer can call Supabase directly, just like the web app.

Consequence: the web app is essentially the current `src/` folder wrapped by Vite instead of Electron. We share the UI rather than rebuild it.

```
            BEFORE                                AFTER
  pages → src/lib/api.ts → window.api    pages → src/lib/api.ts → supabase-js → Supabase
            (IPC → sql.js)                         (same pages, both desktop + web)
```

The Electron IPC/sql.js data layer (`ipc.ts`, `database.ts`, `db-wrapper.ts`) is retired for data. IPC stays only for licence, auto-update, and window concerns.

---

## 2. Supabase schema

Recreate the 11 existing tables in Postgres with two additions on every table: a `garage_id` foreign key and RLS. Primary keys stay `bigint generated always as identity` (server-generated), which is safe under online-first.

**New tables**
- `garages` — one row per customer/account. `id`, `name`, `licence_key`, `created_at`.
- `garage_members` — maps a Supabase Auth user to a garage: `user_id (uuid, → auth.users)`, `garage_id`, `role`. This is what RLS reads to resolve "which garage is this user". (Single-user-per-garage now; the table leaves room for staff logins later.)

**Existing tables** (`settings`, `customers`, `vehicles`, `jobs`, `job_line_items`, `invoices`, `invoice_line_items`, `quotes`, `quote_line_items`, `bookings`, `parts`) — same columns as today, plus `garage_id bigint not null references garages(id)`. `settings` changes from a single hard-coded `id=1` row to one row per garage.

**RLS** — enabled on every table. One helper, then uniform policies:

```sql
create function current_garage_id() returns bigint language sql stable security definer as $$
  select garage_id from garage_members where user_id = auth.uid() limit 1
$$;

-- per table, e.g. jobs:
create policy garage_isolation on jobs
  for all using (garage_id = current_garage_id())
  with check (garage_id = current_garage_id());
```

This guarantees a garage can never read or write another garage's rows, even though both apps use the public anon key.

**Aggregations and JOINs** — most current SQL is simple CRUD that maps cleanly to `supabase-js` (including embedded relations, e.g. `select('*, customers(first_name,last_name), vehicles(registration)')`). A handful are aggregate/multi-join reads that are cleanest as **Postgres views or RPC functions**, called via `supabase.rpc(...)`:
- `customers:getAll` (per-customer vehicle_count, job_count)
- `jobs:getAll` (per-job summed line-item total + filters/search)
- `dashboard:getData` (today's bookings, in-progress jobs, revenue this/last month, outstanding invoices, MOT/service alerts, recent jobs, status counts)
- `reports:revenue` and `reports:jobs`

**Atomic numbering** — `job_number`, `invoice_number`, `quote_number` are currently generated in JS by reading the last row / a counter. Across two devices that can collide. Move each into an RPC (`create_job`, `create_invoice`, `create_quote`) that allocates the next number atomically inside a transaction.

All of this ships as a single, idempotent SQL migration file checked into `GarageLY-Backend/` and applied to Supabase via the SQL editor (or `psql` with the service_role connection).

---

## 3. Auth and licence linking

One account, both platforms. Flow (keeps the existing activation screen as the entry point):

1. New user opens the desktop app (or web app) → **Sign up / activate** screen: email, password, and `GRLY-XXXX-XXXX-XXXX` key.
2. A backend Netlify Function (`activate-account`) validates the key against Supabase (reusing the existing `validate-licence` logic), creates the Supabase Auth user, creates the `garages` row, and links them in `garage_members`. The key is marked as bound to that account.
3. Thereafter, **login is plain email + password** on either platform. The same credentials work on desktop and web; both resolve to the same `garage_id`, hence the same data.
4. Licence validation continues to run (now keyed to the logged-in account). The existing 7-day offline grace for the licence is preserved.

`App.tsx` gating becomes: `checking → not-authed (login/activate) → authed (app)`. Licence status is checked as part of the session rather than as a separate gate. The existing `Activate.tsx` page is extended (email + password fields) rather than replaced.

**Security note:** the web bundle and desktop app use only the public **anon** key (safe to ship — RLS protects data). The **service_role** key stays server-side in Netlify Functions only and is never bundled.

---

## 3b. Demo mode + startup guide

New accounts begin in **demo mode** so the app never looks empty on first run:
- `garages.is_demo` defaults to `true`. On account creation, the backend calls `seed_demo_data(garage_id)` to populate that garage with demo customers, vehicles, parts, jobs, invoices, quotes, and bookings (the current seed set, now per-garage).
- A **startup guide** banner shows while `is_demo = true`: a short checklist (set your business details, add your first customer, create a job) plus a prominent **"Clear demo data & start fresh"** button.
- That button calls the `end_demo_mode()` RPC, which deletes all business rows for the garage, resets `settings` and the invoice/quote counters, and sets `is_demo = false`. The banner then disappears and the garage starts entering real data on a clean slate.

This appears on both desktop and web (shared UI). It is safe — `end_demo_mode()` only ever touches the caller's own garage via RLS.

## 4. Offline (online-first + cached reads)

A thin cache wrapper around the Supabase `api`:
- On every successful read, store the response in IndexedDB keyed by the call signature.
- If a read fails because the network is down, serve the cached copy and surface a small "offline — showing last synced data" banner.
- Writes while offline are rejected with a clear message ("reconnect to save") rather than queued.

This satisfies "still works offline" for viewing without the cost and risk of a full sync engine.

---

## 5. Web app (`GarageLY-Web/`)

Scaffold a Vite + React + TS app that **reuses** the existing pages/components rather than duplicating them. Practical approach: a Vite alias so `GarageLY-Web` imports the shared `src/pages`, `src/components`, `src/lib` directly (single source of truth), with only the web entry point (`main.tsx`, router, no Electron) living in `GarageLY-Web`. Identical UI and dark theme fall out automatically.

Env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. Deploy to Netlify as `garagely-app.netlify.app` (or your preferred subdomain). Netlify CLI is already linked.

---

## 6. Milestones (suggested build order)

1. **Supabase foundation** — final schema + `garage_id` + RLS + views/RPCs + atomic numbering, as one migration file; apply to Supabase; seed one demo garage to test against.
2. **Shared data layer** — add `supabase-js`; rewrite `src/lib/api.ts` as a Supabase implementation of `GaragelyAPI`; reproduce all ~40 endpoints; add the offline read-cache wrapper.
3. **Auth in desktop** — `activate-account` function; extend `Activate.tsx` (email/password); login screen; rework `App.tsx` gating; confirm licence flow intact.
4. **Web app** — scaffold `GarageLY-Web/`, wire shared UI + Supabase, build, deploy to Netlify.
5. **Verify** — cross-device test (save on desktop → appears on web); RLS isolation test (two garages can't see each other's data); offline read test; licence still activates and gates correctly. Use a subagent for an independent verification pass.
6. **Notion** — update "GarageLY — Project Master Doc" with the web app URL, anon key, and new migration/RPC files.

---

## 7. Risks & notes

- **Complex SQL → views/RPC.** The five aggregate endpoints (section 2) are the most involved part of the data-layer rewrite; everything else is mechanical CRUD.
- **Integer PKs retained.** Fine for online-first. If you ever want true offline-write sync later, that would require switching to UUIDs and a sync queue — a separate, larger project.
- **Code sharing.** Using a Vite alias to share `src/` between desktop and web avoids copy-paste drift. If you'd rather fully separate the two codebases, that's a deliberate trade-off (less coupling, double maintenance) — flag it and I'll adjust.
- **Demo/seed data.** I'm assuming the current seed data is demo only and there's no live customer data to migrate. New accounts start empty (optionally with demo data on request). Confirm if any real data needs importing.
- **No secrets in the web bundle.** Anon key only client-side; service_role stays in Netlify Functions.

---

## 8. What I need from you to start building

- Approve this plan (or tell me what to change).
- Confirm the web app subdomain (`garagely-app.netlify.app` or other).
- Confirm there's no live customer data to migrate (demo seed only).
- I'll need the Supabase service_role key (from the Notion master doc) to apply the migration — confirm I should pull it from Notion.
