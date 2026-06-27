# GarageLY — Round 3 updates: what I built + what you need to do

Everything below is **code-complete and type-checked**. A few steps need running on
your Mac / live infra because the sandbox can't reach Supabase, Cloudflare or Netlify.

## What changed

1. **Responsive / vertical layout** — sidebar now collapses to a slide-in drawer
   (hamburger top-left) on narrow/vertical windows; every page grid stacks to a
   single column on small screens; wide tables scroll horizontally instead of crushing.
2. **No more false MOT/service warnings** — a vehicle with no date entered no longer
   raises an alert. Fixed both client-side (live immediately) and in the dashboard SQL.
3. **Timmy** — redesigned to read clearly as a chrome socket (chamfered hex drive,
   fluted barrel, "10" stamp) while keeping his face, arms & legs. He now tells car
   jokes: a 🔧 smiley button + "Tell me a joke" chip, and a cheeky personality in the
   AI prompt. Jokes work even if the Worker isn't redeployed (they're built into the app).
4. **More settings** — Branding (accent colour picker + interface density),
   Business Defaults (currency, reminder lead time, payment terms, bank details),
   Documents & Templates (default quote/invoice notes, T&Cs, invoice & job-sheet footers).
   Accent colour now drives buttons + active menu app-wide. Default quote notes auto-fill new quotes.
5. **Admin account controls** — Suspend/Reactivate, **Reset password** (emails a link, or
   shows a copyable link if email isn't set up), **Resend licence key** by email, and an
   **Edit** modal for garage name / status / plan / expiry.
6. **Preset Jobs (pre-quoted jobs)** — new sidebar page to build a catalogue of common
   jobs (each with its own parts + labour lines). In a new quote, **"+ Preset job"** lets
   you tick several (e.g. intercooler + downpipe + Stage 1 tune) and drops all their lines in.

## ⚠️ Steps for you to run

> Hosting note: GarageLY runs on **Cloudflare** now (Worker + Pages), not Netlify.
> Ignore the old Netlify tabs/dashboards — they're superseded. All deploys use `wrangler`.

### 1. Apply the database migration — ✅ DONE (applied & verified 2026-06-27)
`GarageLY-Backend/migrations/0008_settings_presets_dashboardfix.sql` was run in the Supabase
SQL editor. Verified: both preset tables created, all 10 new settings columns added, RLS on.
Nothing more to do here.

### 2. Deploy the Worker (Timmy's new persona + admin reset/resend)
```
cd GarageLY-Worker && wrangler deploy
```
URL: https://garagely-backend.garagely.workers.dev. App is usable without this (jokes + the
dashboard fix are client-side), but the admin **Reset password** / **Resend key** buttons and
Timmy's funnier AI replies need it.

### 3. Rebuild + deploy the web app
```
cd GarageLY-Web && npm run build && wrangler pages deploy dist --project-name garagely-app
```
URL: https://garagely-app.pages.dev

### 4. Deploy the admin app
```
cd GarageLY-Admin && npm run build && wrangler pages deploy dist --project-name garagely-admin
```
URL: https://garagely-admin.pages.dev

### 5. Rebuild the desktop app / cut a release (can wait)
Your usual flow (`npm run build && npx electron-builder --mac --arm64`, or push a tag for CI).

### 6. Tidy up (housekeeping)
Some hidden temp files were left by the bulk edit on the mounted folder. From the project root:
```
rm -f src/pages/.fuse_hidden*
```

## Notes
- Reset-password emails only send if `SENDGRID_API_KEY` + `SENDGRID_FROM` are set on the
  Worker; otherwise the admin UI shows a copyable reset link instead.
- Pre-existing type errors remain in Activate/Invoices/Jobs/Reports (app) and the admin's
  `import.meta.env` typing — these predate this round and don't block the vite build.
