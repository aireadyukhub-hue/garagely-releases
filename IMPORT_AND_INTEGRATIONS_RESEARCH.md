# GarageDash — Importability, Calendar Sync & Unified Inbox Research
*17 July 2026*

Goal: make switching TO GarageDash painless (especially from Setmore), plus calendar linking and a one-place customer inbox.

---

## 1. What other services let you export

| Source | Customers | Appointments | Vehicles | Notes |
|---|---|---|---|---|
| **Setmore** | ✅ CSV (emailed to account owner) | ✅ .XLS via Settings → Booking Page → Reports (≤3-month ranges) | ❌ no vehicle concept | Also has a full REST API (Pro plan, request access via api@setmore.com, OAuth) |
| **Square Appointments** | ✅ CSV (Dashboard → Customers → Import/Export) | ✅ CSV (Appointments → Settings → History → Export) | ❌ | Square itself can't import appointments — we can win here |
| **Calendly** | Partial (invitee export CSV per event type) | ✅ CSV of scheduled events | ❌ | |
| **Fresha / Booksy** | ✅ CSV (Booksy via support request) | Limited | ❌ | Salon-focused, less relevant |
| **Garage Hive** | ✅ (Dynamics backend, exports via reports/support) | ✅ | ✅ | Assisted migration common |
| **TechMan** | ✅ CSV via reports | ✅ | ✅ | |
| **MAM Autowork Online** | ✅ (export/support request) | ✅ | ✅ | Big legacy install base = migration opportunity |
| **Motasoft VGM** | ✅ CSV | ✅ | ✅ | |
| **Google Contacts / Excel / paper diary** | ✅ CSV | manual | manual | Common for small garages |

**Takeaway:** virtually every source can produce a customer CSV; appointment history varies (CSV/XLS). Garage-specific systems also export vehicles; generic booking tools (Setmore, Square, Calendly) don't have vehicles at all.

---

## 2. GarageDash import wizard (recommended build)

No CSV import exists in the app today — this is a new feature. Target schema is already clean:

- `customers`: first_name, last_name, email, phone, mobile, address, city, postcode, notes
- `vehicles`: registration, make, model, year, vin, fuel_type, mileage, mot_due, service_due (linked to customer)
- `bookings`: title, start_time, end_time, customer_id, vehicle_id, status, notes

### Design
1. **Generic CSV importer with column mapping** (upload → preview → map columns → dedupe → import). Accept CSV *and* XLS/XLSX (SheetJS) since Setmore appointments come as .XLS.
2. **Source presets** that pre-fill the mapping: "Setmore", "Square", "Google Contacts", "Generic CSV". One dropdown = feels like a dedicated migration tool, costs almost nothing.
3. **Dedupe rules:** match on email → mobile → name+postcode. Offer merge/skip.
4. **VRM enrichment (killer feature):** Setmore/Square have no vehicle fields, so garages stuff the reg into appointment titles/notes (e.g. "MOT — AB12 CDE"). Regex-extract UK VRMs from imported text, then run them through the **existing DVSA VRM lookup** to auto-create fully populated vehicle records (make/model/fuel/MOT due). Nobody else does this — great marketing line: *"Import your Setmore history and we'll rebuild your vehicle database automatically."*
5. **Import report:** X customers added, Y merged, Z vehicles created, N rows skipped (downloadable).

### Setmore-specific runbook (your garage = the pilot)
1. Setmore web app → Customers → Options → **Export Customers** → CSV arrives by email.
2. Settings → Booking Page → **Reports** → generate in ≤3-month chunks → **Export as .XLS** (repeat back through history).
3. Import customers CSV first, then appointment XLS files; wizard links appointments to customers by name/email and VRM-enriches.
4. Services/staff: recreate manually (small lists; Setmore has no export for these).
5. Optional later: Setmore API integration for a live "sync from Setmore" during a transition period — probably overkill vs. one-time CSV.

**Effort:** ~1–2 weeks for wizard + Setmore/Square presets + VRM enrichment.

---

## 3. Google Calendar linking

Three tiers, in order of effort:

**A. iCal feed OUT (ship first — days, not weeks).** Worker endpoint serving `/calendar/:token.ics` from the bookings table. Garage subscribes in Google Calendar (or Apple/Outlook) via URL. Pros: no OAuth, no Google review, works everywhere. Con: read-only, Google refreshes external feeds slowly (hours, not minutes).

**B. One-way push via Google Calendar API (recommended v2).** OAuth connect → GarageDash creates/updates/deletes events in their Google Calendar instantly when bookings change. Calendar scopes are "sensitive" → requires Google OAuth verification review (form + demo video; no expensive security audit — that's only for *restricted* scopes like Gmail). Effort: ~1 week + review wait.

**C. Full two-way sync.** Watch channels (webhook push, ~4s propagation, HTTPS required), sync tokens, 15-min polling fallback because webhooks drop occasionally, conflict/dedupe logic. Real engineering. Only worth it if garages actually create bookings *in* Google Calendar. Park it.

**Recommendation:** ship A now, B next, C only on demand.

---

## 4. Unified inbox (email + Facebook messages)

One screen in GarageDash where customer emails and FB Page messages land and get replied to.

### Email — two routes
- **Recommended: Cloudflare Email Routing + Email Workers** (you're already all-in on Cloudflare). Garage gets/points an address like `bookings@theirgarage.com` (or forwards their existing address) → Email Worker parses inbound mail → stores in a `messages` table → replies sent via an outbound API (Resend/Postmark/SES) with proper Reply-To so threading works. No Google review, works with any email provider, fits current stack.
- **Avoid (for now): Gmail API full mailbox access.** Reading/sending a user's Gmail = *restricted* scopes → annual CASA security assessment (thousands of £/yr) + heavy verification. Not viable at current stage.

### Facebook Page messages
- Meta **Messenger Platform**: webhook receives Page messages; Send API replies. Needs a Meta developer app, the garage's Page connected to a Meta Business account, `pages_messaging` (+ `business_management`) permissions, and **Meta App Review**.
- Constraints: replies allowed free-form only within the **24-hour window** after the customer's last message (fine for booking chats); human-agent tag extends to 7 days but needs extra review approval. Instagram DMs come almost free once this is built (`instagram_manage_messages`).
- App Review is the real cost — expect a few weeks of back-and-forth with screencasts.

### Phasing
1. **v1:** unified inbox UI + email via Cloudflare Email Workers (~1–2 weeks).
2. **v2:** Messenger integration once App Review passes (start the Meta app + review process early — it can run in parallel).
3. **Later:** Instagram DMs, WhatsApp Business API (huge for UK garages — customers already send MOT photos by WhatsApp; needs Meta Business verification too).

---

## 5. Suggested roadmap

| # | Feature | Effort | Why first |
|---|---|---|---|
| 1 | CSV/XLS import wizard + Setmore preset + VRM enrichment | 1–2 wks | Removes #1 switching objection; you can dogfood with your own Setmore data |
| 2 | iCal feed out | 2–3 days | Cheap, instant "works with Google Calendar" bullet point |
| 3 | Unified inbox v1 (email via CF Email Workers) | 1–2 wks | Fits Cloudflare stack, no third-party reviews |
| 4 | Google Calendar one-way push (OAuth) | 1 wk + review | Upgrade path from #2 |
| 5 | FB Messenger in inbox | 1 wk + Meta review | Start review paperwork during #3 |
| 6 | Two-way calendar sync / WhatsApp | later | On demand |

---

## Sources
- [Setmore: Import or Export Customer Contacts](https://support.setmore.com/en/articles/490978-import-or-export-customer-contacts)
- [Setmore: Export Appointment History](https://support.setmore.com/en/articles/491014-export-appointment-history)
- [Setmore: Request API Access](https://support.setmore.com/en/articles/579360-request-access-to-the-setmore-api) · [Setmore developers](https://www.setmore.com/developers)
- [Square: import/export customers](https://squareup.com/help/us/en/subtopic/import-and-export-customers) · [Square community: appointment import limits](https://community.squareup.com/t5/Questions-How-To/How-do-I-transfer-all-appointments-and-client-info-from-another/td-p/174171)
- [Google Calendar API push notifications](https://developers.google.com/workspace/calendar/api/guides/push)
- [Meta Messenger Platform overview](https://developers.facebook.com/documentation/business-messaging/messenger-platform/overview) · [Send messages](https://developers.facebook.com/documentation/business-messaging/messenger-platform/send-messages)
- UK garage software comparisons: [torqueflow.app](https://torqueflow.app/blog/garage-software/) · [Garage Hive alternatives](https://esremedia.co.uk/blog/garage-hive-alternatives-uk)
