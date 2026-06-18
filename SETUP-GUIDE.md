# GarageLY — Commercial Setup Guide

Everything you need to go from "code on your Mac" to "paying subscribers auto-updating."

---

## Overview

```
GarageLY app (Electron)
    ↕ licence validation
GarageLY-Backend (Netlify Functions)
    ↕ reads/writes
Supabase (Postgres database)
    ↕ payment events
Stripe (subscriptions)

GarageLY-Admin (Netlify site)
    ↕ admin API calls
GarageLY-Backend
```

---

## Step 1 — GitHub (auto-updates + Windows builds)

You said you're now logged into GitHub. Do this:

1. Go to https://github.com/new
2. Create a repository called **`garagely-releases`** (Public, no README)
3. Copy your GitHub **username** (shown top-right on GitHub)
4. Open `package.json` in the GarageLY folder and replace `YOUR_GITHUB_USERNAME` with your actual username in the `"publish"` section
5. Go to **GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)**
6. Generate new token → name it `GarageLY CI` → tick **`repo`** scope → copy the token
7. Save this token — you'll need it in Step 4 (GitHub Actions secret `GH_TOKEN`)

---

## Step 2 — Supabase (database)

1. Create free account at https://supabase.com
2. New project — name it `garagely`, pick a region close to UK (West EU)
3. Once created, go to **SQL Editor → New query**
4. Copy everything from `GarageLY-Backend/supabase-schema.sql` and run it
5. Go to **Settings → API** and copy:
   - **Project URL** (looks like `https://abcdef.supabase.co`)
   - **service_role** key (under Project API keys — the long `eyJ...` one)

---

## Step 3 — Stripe (payments)

1. Create account at https://stripe.com (or log in)
2. **Products → Add product**
   - Name: "GarageLY Monthly"
   - Pricing: £29.00 / month, recurring
   - Copy the **Price ID** (starts `price_...`)
3. **Developers → API keys** → copy the **Secret key** (`sk_live_...`)
   - While testing, use the **Test** secret key (`sk_test_...`) — switch to live when ready
4. **Developers → Webhooks → Add endpoint**
   - URL: `https://YOUR-BACKEND.netlify.app/.netlify/functions/stripe-webhook`
     *(fill in the Netlify URL after Step 4)*
   - Select events:
     - `checkout.session.completed`
     - `invoice.payment_succeeded`
     - `invoice.payment_failed`
     - `customer.subscription.deleted`
     - `customer.subscription.updated`
   - Copy the **Signing secret** (`whsec_...`)

---

## Step 4 — Backend on Netlify

1. Create account at https://netlify.com
2. **Add new site → Deploy manually**
3. In **Site configuration → Environment variables**, add:

| Variable | Value |
|---|---|
| `SUPABASE_URL` | Your Supabase Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase service_role key |
| `STRIPE_SECRET_KEY` | Your Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Your Stripe webhook signing secret |
| `STRIPE_PRICE_ID` | Your Stripe price ID |
| `TRIAL_DAYS` | `14` |
| `ADMIN_SECRET` | A strong password you choose (you'll use this to log into the admin dashboard) |

4. In **Site configuration → General**, rename your site to something like `garagely-backend`
5. Open Terminal in `GarageLY/GarageLY-Backend/` and run:
   ```
   npm install
   npm install -g netlify-cli
   netlify login
   netlify link   (pick your site)
   netlify deploy --prod
   ```
6. Your backend URL will be: `https://garagely-backend.netlify.app`

---

## Step 5 — Admin Dashboard on Netlify

1. Back in Netlify, **Add new site → Deploy manually** (second site)
2. In **Site configuration → Environment variables**, add:
   - `VITE_BACKEND_URL` = `https://garagely-backend.netlify.app`
3. Open Terminal in `GarageLY/GarageLY-Admin/` and run:
   ```
   npm install
   netlify link   (pick your new admin site)
   npm run build
   netlify deploy --prod --dir=dist
   ```
4. Go to your admin URL in a browser and log in with the `ADMIN_SECRET` you set

---

## Step 6 — Test everything end-to-end

1. In the admin dashboard, go to **Create Trial**
2. Enter your own email + "Test Garage" — generate a licence key (e.g. `GRLY-AB12-CD34-EF56`)
3. Run `npm run dev` in the GarageLY folder
4. The activation screen should appear — enter the key
5. App should unlock ✓

---

## Step 7 — GitHub Actions (Windows + Mac builds)

1. In your `garagely-releases` GitHub repo, go to **Settings → Secrets and variables → Actions**
2. Add secret: `GH_TOKEN` = your Personal Access Token from Step 1
3. *(Mac code signing is optional for now — skip the certificate secrets until you're ready to sell publicly)*

**To release a new version:**
```bash
# In Terminal, in the GarageLY folder:
npm version patch    # bumps 1.0.0 → 1.0.1 (or use minor/major)
git push --follow-tags
```
GitHub Actions will automatically build Mac + Windows installers and create a GitHub Release. All installed copies of GarageLY will auto-update within minutes.

---

## What each piece costs (monthly)

| Service | Cost |
|---|---|
| Supabase | Free (up to 500MB, 50k rows) |
| Netlify | Free (up to 100GB bandwidth) |
| Stripe | 1.5% + 25p per transaction (UK cards) |
| GitHub | Free |

At £29/month per garage, Stripe fees are ~£0.69 per payment — so you keep ~£28.31.

---

## Update workflow (firmware-style)

1. Tell Claude what changes you want
2. Claude edits the files
3. You test with `npm run dev`
4. When happy: `npm version patch && git push --follow-tags`
5. GitHub Actions builds both Mac and Windows installers automatically
6. All garage owners get an in-app notification and update silently

---

## Licence key format

All keys are: **`GRLY-XXXX-XXXX-XXXX`**

Generated automatically when:
- A garage completes Stripe checkout (via `stripe-webhook` function)
- You manually create a trial in the admin dashboard

The key is stored locally on the garage's computer and validated against Supabase on every app startup. 7-day offline grace period built in.
