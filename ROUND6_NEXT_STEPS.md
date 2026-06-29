# GarageLY — Round 6: labour times, digital inspections, fault-code lookup

Built autonomously while you were at work. All code-complete and type-checked (the only tsc
errors are the same pre-existing ones in Activate/Invoices/Jobs/Reports — none of this round's).

## What's new

### 1. Labour-times library (Preset Jobs)
- Preset Jobs now have an **estimated labour hours** field. When a preset is added to a quote,
  it auto-creates a labour line priced at your **current labour rate** (`hours × rate`).
- New **"+ Common UK jobs"** button on the Preset Jobs page one-click seeds ~20 common jobs
  with sensible default hours (brakes, cambelt, clutch, service, etc.) — edit/refine any of them,
  and replace with the times you're gathering from the other AI when ready.
- Preset cards and the quote picker now show/total the labour.

### 2. Digital Inspections (the #1 competitive gap)
- New **Inspections** page (sidebar). Run a vehicle health check: pick customer + vehicle + mileage,
  then a grouped checklist (Tyres, Brakes, Lights & Electrics, Under Bonnet, Steering & Suspension,
  Exhaust & Body) with **Pass / Advisory / Fail / N-A** per item + notes.
- Overall result auto-computed (fail > advisory > pass).
- **Print** a clean, branded customer report (uses your logo + business details) — green/amber/red,
  per-item notes, ready to hand or send to the customer.

### 3. Fault-code lookup (no setup needed)
- New **Fault Codes** page. Search an OBD code (e.g. `P0420`) or keyword (e.g. "misfire") →
  meaning, **severity**, common **causes** and common **fixes**.
- Ships with a curated **starter set of ~35 common UK petrol & diesel codes** (generic OBD-II codes
  are public — no licensing). The make filter is in place for the future manufacturer-specific set.
- This is a self-contained, client-side feature — **no migration, works as soon as the web app is deployed.**
  Expand the dataset later (`src/lib/faultCodes.ts`) with the full list you generate via another AI.

## ⚠️ To make it live

### 1. Apply the database migration (for labour times + inspections)
Run **`GarageLY-Backend/migrations/0009_labour_hours_inspections.sql`** in the Supabase SQL editor.
(Adds `preset_jobs.labour_hours` and the `inspections` table + RLS.) The fault-code page needs nothing here.

### 2. Deploy the web app
```
cd "/Users/lewisfelix/Documents/Claude/Projects/GarageLY/GarageLY-Web" && npm run build && wrangler pages deploy dist --project-name garagely-app
```

### 3. (When ready) cut a desktop release so it reaches the Windows/desktop app
```
cd "/Users/lewisfelix/Documents/Claude/Projects/GarageLY"
git add -A && git commit -m "v1.2.3: labour-times library, digital inspections, fault-code lookup"
git push
git tag v1.2.3 && git push origin v1.2.3
```
(package.json is already bumped to **1.2.3**, so the tag matches — auto-update will fire correctly.)

## Notes
- Inspections report reuses your existing print helper (works on desktop + web).
- The labour-times "Common UK jobs" set is a starting point — your real times will be better; just edit them.
- Roadmap (Notion) updated earlier with payments/SMS/HPI greenlit + "Find My Garage" plan.
