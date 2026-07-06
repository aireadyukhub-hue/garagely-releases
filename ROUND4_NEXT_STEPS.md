# GarageDash — Round 4 updates: what I built + what you need to do

Code-complete and type-checked. Hosting is **Cloudflare** (Worker + Pages) — ignore old Netlify tabs.

## What changed

1. **Quick "+ New" customer button** — sits next to the customer dropdown in the New Quote,
   New Booking (Calendar), New Job Sheet and New Invoice windows. Click it, fill name + contact,
   and the new customer is created and auto-selected without leaving the screen.
2. **Holiday date ranges** — Team → Book time off now has a "From" and "To (optional)" date.
   Booking two weeks off is one action; it shows the day count and books each day in one go.
3. **Search local suppliers** — Suppliers → "Search local". Type a postcode + radius, it lists
   nearby motor factors / car-parts shops (name, address, phone, website, distance), tick the
   ones you want, and they're added to your suppliers list. Skips ones you already have.

## ⚠️ Steps for you to run

### 1. Set up the Google Places API key (needed for "Search local suppliers")
You said you're happy to set this up. It has a free monthly tier, but Google requires a billing
account on file.

1. Go to https://console.cloud.google.com → create a project (or pick one).
2. APIs & Services → **Enable APIs** → enable **"Places API (New)"** and **"Geocoding API"**.
3. APIs & Services → Credentials → **Create credentials → API key**. Copy it.
   (Optional but recommended: restrict the key to those two APIs.)
4. Make sure **billing is enabled** on the project (Google won't return results otherwise).
5. Put the key on the Worker and redeploy:
   ```
   cd "/Users/lewisfelix/Documents/Claude/Projects/GarageLY/GarageDash-Worker"
   wrangler secret put GOOGLE_PLACES_API_KEY
   # paste the key when prompted, then:
   wrangler deploy
   ```
Until this is done, the "Search local" button works but shows a friendly "not set up yet" message.

### 2. Deploy the Worker (also carries the new places-search endpoint)
```
cd "/Users/lewisfelix/Documents/Claude/Projects/GarageLY/GarageDash-Worker" && wrangler deploy
```
(If you did step 1's `wrangler deploy`, this is already done.)

### 3. Rebuild + deploy the web app (carries all 3 round-4 features)
```
cd "/Users/lewisfelix/Documents/Claude/Projects/GarageLY/GarageDash-Web" && npm run build && wrangler pages deploy dist --project-name garagedash-app
```

### 4. Desktop release (optional, when ready)
Cut a release as usual so the installed desktop app picks up these features too.

## Notes
- Google Places gives name / address / phone / website. It does **not** expose email, so the
  email field stays blank on imported suppliers (you can add it later by editing the supplier).
- The supplier search is sign-in protected (it runs through your Worker so the API key is never
  exposed in the browser).
- No database migration this round — nothing to run in Supabase.
