# Get the Import wizard live — run in Terminal on your Mac

Takes ~5 minutes. This gets the web app (app.getgaragely.com) updated, which is
all Chloe needs for Monday. (If you haven't run the DEPLOY_v1.2.6.md steps yet,
this deploy carries those web-app changes out too — that's fine.)

## 1. Install the new dependency (both folders)

```
cd ~/Documents/Claude/Projects/GarageLY
rm -f .git/index.lock
npm install
cd GarageDash-Web
npm install
```

## 2. Build & deploy the web app

```
npm run build
wrangler pages deploy dist --project-name garagedash-app
```

Then open https://app.getgaragely.com → Settings → **Your Data** → Import Data
and sanity-check it loads. Try the two files in `test-fixtures/` on a demo/test
account if you want to see the full flow before Monday.

## 3. Commit so nothing gets lost

```
cd ~/Documents/Claude/Projects/GarageLY
git add -A
git commit -m "Import wizard: Setmore/Square/CSV import with VRM enrichment (Settings → Your Data)"
git push origin main
```

(No tag needed — tags only trigger desktop releases; the import feature will
ride along in the next one.)

---

# Chloe's test sheet (Monday)

**Get the files out of Setmore first:**
1. Setmore web app → **Customers → Options → Export Customers** → CSV arrives by email to the account owner.
2. **Settings → Booking Page → Reports** → pick a date range (3 months max per go) → **Generate** → **Export as .XLS**. Repeat for as much history as wanted — every file goes into the wizard together.

**Then in GarageDash:** Settings → Your Data → Import Data → Setmore → add all the files → check the column matching looks right → Start import.

**Things to check after:**
- Customer count looks right, no obvious duplicates
- A few appointments on the calendar at the right day/time
- Vehicles page — regs found in appointment titles should have make/model/MOT date filled in
- The results screen: skipped-rows download if anything failed

**Notes:**
- It imports into whichever garage account she's signed into — use the real one (that's the point) but maybe run the customers file first, eyeball it, then run the appointment files.
- Re-running the same files is safe — nothing duplicates.
- Every imported booking has "Imported" in its notes, so they're findable if anything needs cleaning up.
- If any column auto-matches wrongly, screenshot the column headers and send them to me — I'll teach the auto-matcher Setmore's real header names.
