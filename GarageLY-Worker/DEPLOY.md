# GarageLY → Cloudflare migration runbook

Moving off Netlify (credit-metered) onto Cloudflare (free tier: 100k Worker
requests/day, **unmetered bandwidth**). Supabase does **not** change.

What moves:
- **Backend** (6 Netlify Functions) → one **Cloudflare Worker** (`GarageLY-Worker`)
- **Web app** (`GarageLY-Web`) → **Cloudflare Pages**
- **Admin** (`GarageLY-Admin`) → **Cloudflare Pages**
- **Marketing site** (`GarageLY-Website`) → **Cloudflare Pages**

Do it in this order. Where you see "→ paste me X", send me the value and I'll
wire it into the code before the next step.

---

## Phase 0 — one-time setup (5 min)

1. Create a free Cloudflare account at https://dash.cloudflare.com/sign-up
   (I can't create accounts for you — do this one yourself.)
2. Install + log in the CLI on your Mac:
   ```
   npm install -g wrangler
   wrangler login          # opens a browser → Allow
   wrangler whoami         # should show your email + account id
   ```

---

## Phase 1 — deploy the backend Worker

You'll need the same config values that are in your Netlify backend today.
Grab them from: Netlify → garagely-backend → Site configuration → Environment
variables. Have these to hand:
`SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
`ADMIN_SECRET`, `STRIPE_PRICE_ID`, and (optional) `SENDGRID_API_KEY`.

1. Edit `GarageLY-Worker/wrangler.toml` and fill the two placeholders:
   - `STRIPE_PRICE_ID` = your live `price_…` id
   - `SITE_URL` = leave as-is for now (we set it after the marketing site is up)

2. Install + set the secrets (each command prompts you to paste the value —
   the value never gets stored in the repo):
   ```
   cd ~/Documents/Claude/Projects/GarageLY/GarageLY-Worker
   npm install
   wrangler secret put SUPABASE_SERVICE_ROLE_KEY
   wrangler secret put STRIPE_SECRET_KEY
   wrangler secret put STRIPE_WEBHOOK_SECRET
   wrangler secret put ADMIN_SECRET
   wrangler secret put SENDGRID_API_KEY      # optional; skip if not using email yet
   ```

3. Deploy:
   ```
   wrangler deploy
   ```
   It prints a URL like `https://garagely-backend.<your-subdomain>.workers.dev`.

4. Smoke-test it:
   ```
   curl https://garagely-backend.<your-subdomain>.workers.dev/health
   # → {"ok":true,"service":"garagely-backend"}
   ```

→ **paste me that workers.dev URL.** I'll bake it into the web app, admin,
   marketing site, and desktop app, then you continue to Phase 2.

---

## Phase 2 — deploy the three sites to Cloudflare Pages

(After I've updated the backend URLs in the code.)

**Web app:**
```
cd ~/Documents/Claude/Projects/GarageLY/GarageLY-Web
npm install && npm run build
wrangler pages deploy dist --project-name garagely-app
```

**Admin dashboard:**
```
cd ~/Documents/Claude/Projects/GarageLY/GarageLY-Admin
npm install && npm run build
wrangler pages deploy dist --project-name garagely-admin
```

**Marketing site** (no build step — it's static HTML):
```
cd ~/Documents/Claude/Projects/GarageLY/GarageLY-Website
wrangler pages deploy . --project-name garagely
```

Each prints a `*.pages.dev` URL.

→ **paste me the three pages.dev URLs.**

---

## Phase 3 — point Stripe + the Worker at the new URLs

1. I set the Worker's `SITE_URL` var to the new marketing `pages.dev` URL; you
   redeploy the Worker (`wrangler deploy`) so checkout redirects land correctly.

2. **Stripe webhook** — in the Stripe dashboard → Developers → Webhooks, edit
   the existing endpoint URL to:
   `https://garagely-backend.<your-subdomain>.workers.dev/stripe-webhook`
   (Same events as before. The signing secret is unchanged, so no secret edit
   needed.)

3. Test end to end: a Stripe test/live checkout creates a licence; the success
   page shows the key; activating in the app works; the admin dashboard loads
   Licences + Feedback & Support.

---

## Phase 4 — desktop app (do whenever)

The installed desktop apps have the old Netlify backend URL baked in. They keep
working from cached licence data, but **new** activations need the new URL. Once
I've updated `electron/licence.ts`, cut a new release so future installs use the
Worker. Existing users just need that update.

---

## Rollback / safety

- The Netlify sites still exist; nothing here deletes them. If anything misfires,
  the old URLs keep responding until Netlify suspends them for credits.
- Keep the Netlify backend around until Stripe + activations are confirmed working
  on Cloudflare, then you can let it lapse.
