# GarageLY Backend

Netlify Functions + Supabase backend for licence management and Stripe billing.

## Setup

### 1. Supabase
1. Create a free project at https://supabase.com
2. Open **SQL Editor → New query**, paste `supabase-schema.sql`, and run it
3. Copy your **Project URL** and **service_role key** from Settings → API

### 2. Stripe
1. Create account at https://stripe.com
2. Create a product: **Products → Add product**
   - Name: "GarageLY Subscription"
   - Recurring price: £29.00 / month
   - Copy the **Price ID** (starts with `price_`)
3. Go to **Developers → API keys** and copy your **Secret key**
4. Go to **Developers → Webhooks → Add endpoint**
   - URL: `https://YOUR-NETLIFY-SITE.netlify.app/.netlify/functions/stripe-webhook`
   - Events: `checkout.session.completed`, `invoice.payment_succeeded`, `invoice.payment_failed`, `customer.subscription.deleted`, `customer.subscription.updated`
   - Copy the **Signing secret**

### 3. Netlify
1. Create account at https://netlify.com
2. **New site → Import an existing project → Deploy manually** (or connect GitHub)
3. In **Site settings → Environment variables**, add all keys from `.env.example`
4. Run `netlify deploy --prod` from this folder

### Netlify Environment Variables to set:
```
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
STRIPE_PRICE_ID
TRIAL_DAYS=14
ADMIN_SECRET=your_strong_password
```

## API Endpoints

### `POST /.netlify/functions/validate-licence`
Called by the GarageLY desktop app on every startup.
```json
{ "key": "GRLY-XXXX-XXXX-XXXX" }
```
Returns `{ valid, status, garageName, trialEndsAt }`.

### `POST /.netlify/functions/create-checkout`
Called by the marketing website to start a Stripe subscription.
```json
{ "email": "owner@garage.com", "garageName": "Bob's Autos" }
```
Returns `{ url }` — redirect user to this Stripe Checkout URL.

### `POST /.netlify/functions/stripe-webhook`
Stripe calls this automatically. Don't call it manually.

### `GET /.netlify/functions/admin-api?action=...`
Admin-only endpoints. Requires `X-Admin-Secret: YOUR_ADMIN_SECRET` header.

Actions:
- `?action=list-licences` — all licences
- `?action=list-licences&status=trial` — filter by status
- `?action=get-licence&key=GRLY-...` — single licence
- `?action=stats` — count by status
- `POST ?action=create-trial` — create manual trial `{ email, garageName, trialDays }`
- `POST ?action=update-licence` — update `{ key, status, garageName }`
- `POST ?action=revoke-licence` — cancel `{ key }`
