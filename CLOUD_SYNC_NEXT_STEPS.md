# GarageLY Cloud Sync — Remaining Steps (need you)

Everything is built and the database is live. Three things remain that require
your machine (Terminal) or a value I can't read for security reasons.

## 1. Add the Supabase anon key (2 mins)

The apps read the public **anon** key from a `.env` file. The browser extension
blocked me from copying it, so paste it yourself:

1. Supabase → Project **garagely** → Settings → **API Keys** → **Legacy** tab → copy the **`anon` `public`** key.
2. Paste it into **both** files, replacing `PASTE_ANON_PUBLIC_KEY_HERE`:
   - `/GarageLY/.env`
   - `/GarageLY/GarageLY-Web/.env`

(The anon key is safe to expose — Row Level Security protects all data.)

## 2. Deploy the backend (adds the new account-activation function)

```bash
cd "/Users/lewisfelix/Documents/Claude/Projects/GarageLY/GarageLY-Backend"
npm install            # first time only — pulls @netlify/functions etc.
netlify deploy --prod  # NOTE: do NOT use --no-build here — it skips bundling the new function
```

This publishes `activate-account` (creates the Supabase Auth user + garage +
links the licence + seeds demo data). No new env vars needed — it reuses the
existing `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.

> `--no-build` is fine for redeploys that only change config, but adding a NEW
> function requires a normal `netlify deploy --prod` so esbuild bundles it.
> Verify afterwards: a GET to `…/.netlify/functions/activate-account` should
> return a 405 (live), not a 404 (not deployed).

## 3. Deploy the web app

```bash
cd "/Users/lewisfelix/Documents/Claude/Projects/GarageLY/GarageLY-Web"
npm install
npm run build
netlify deploy --prod --dir=dist
```

When the CLI asks, **Create & configure a new site** named e.g. `garagely-app`
(you can rename / point a custom domain later). Then in the Netlify dashboard
for that new site, add two environment variables so the production build can
connect:

- `VITE_SUPABASE_URL` = `https://ulrsthmkgsyfeloihens.supabase.co`
- `VITE_SUPABASE_ANON_KEY` = (the anon key from step 1)

…and redeploy once (`netlify deploy --prod --dir=dist`) so they take effect.

## 4. Try it (the whole point)

1. Run the desktop app: `cd /GarageLY && npm run dev`.
2. On the **Activate licence** tab, enter a valid `GRLY-…` key + an email + password → it creates your account and signs you in with demo data.
3. Open the web app URL, **Sign in** with the same email + password → you see the same garage.
4. Add a customer on one, refresh the other → it appears. That's cloud sync. ✅
5. Click **Clear demo data & start fresh** to empty the demo records when ready.

## What changed (for reference)

- `GarageLY-Backend/migrations/0001_cloud_sync.sql` — applied live ✅
- `GarageLY-Backend/netlify/functions/activate-account.ts` — new
- `src/lib/supabase.ts`, `src/lib/auth.ts`, `src/lib/cache.ts` — new
- `src/lib/api.ts` — rewritten (Supabase, was Electron IPC)
- `src/pages/Auth.tsx`, `src/components/DemoBanner.tsx` — new
- `src/App.tsx`, `src/components/layout/Layout.tsx` — auth gating + sign out
- `GarageLY-Web/` — new web app (shares `src/` via a Vite alias)
- The old desktop sql.js layer (`electron/database.ts`, `ipc.ts`, `db-wrapper.ts`)
  is now unused for data but left in place so the licence system still works.
