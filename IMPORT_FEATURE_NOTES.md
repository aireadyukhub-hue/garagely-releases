# Import wizard — built 18 Jul 2026

## What's new
- **Import Data** lives in **Settings → Your Data** (button opens `/import`; kept out of the sidebar to reduce clutter). The page has a "Back to Settings" link.
- Wizard: pick source (Setmore/Square/Google Contacts/other, with export instructions shown) → add CSV/XLS/XLSX files (multiple at once — Setmore's 3-month report chunks all go in together) → check the auto-matched columns → options → run → results report.
- Customers, appointment history (as calendar bookings) and **vehicles** all imported. Regs are found in appointment titles/notes ("MOT — AB12 CDE"), run through the live DVSA lookup (throttled ~1/sec) and become full vehicle records with make/model/fuel/MOT due. Failed lookups become reg-only stubs.
- Duplicates merged by email → phone → name; blank fields on existing customers get filled in. Re-running the same import is safe (existing bookings/customers detected and skipped).
- Setmore statuses map to booking statuses (cancelled/no-show → cancelled, completed → completed, else confirmed).

## Files
- `src/lib/import/parse.ts` — CSV/XLS/XLSX parsing (handles Setmore's .XLS, incl. HTML-table fakes)
- `src/lib/import/vrm.ts` — UK plate extraction from free text (with false-positive guards)
- `src/lib/import/engine.ts` — mapping presets, date/time parsing, dedupe, batched inserts, DVSA enrichment
- `src/pages/Import.tsx` — the wizard UI
- `src/App.tsx` — `/import` route · `src/pages/Settings.tsx` — "Your Data" card linking to it
- `test-fixtures/` — synthetic Setmore-format files to try the wizard with

## Testing done (in sandbox)
- Typecheck clean on all new files.
- 27 unit tests on parsing/mapping/plate-extraction: all pass.
- Full end-to-end run against a faked database using the synthetic Setmore files: merge, booking times, status mapping, vehicle enrichment, stub fallback and idempotent re-run all verified.

## ⚠️ Before you build/deploy
1. `xlsx` was added to `package.json` — run **`npm install`** once locally (package-lock needs updating; the sandbox couldn't write it).
2. `npm run dev`, sign into a test account, go to **Import Data**, and drag in the two files from `test-fixtures/` to see the whole flow.
3. Then do the real thing with your garage's Setmore exports:
   - Customers → Options → Export Customers (CSV arrives by email)
   - Settings → Booking Page → Reports → generate ≤3-month ranges → Export as .XLS (repeat for full history, add every file)
4. The wizard was built against Setmore's documented format but **your real export headers may differ** — the column-matching step is there exactly for that. If anything auto-matches wrongly, note the header names and I'll add them to the auto-matcher.

## Not done yet (next up)
- Marketing site mention ("Switching from Setmore? Import everything in minutes").
- iCal calendar feed, unified inbox (see IMPORT_AND_INTEGRATIONS_RESEARCH.md roadmap).
