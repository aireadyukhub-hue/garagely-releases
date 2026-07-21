# Booking reminders, custom email & deposits — deploy steps

Adds three things (sandbox can't reach Supabase/Cloudflare, so these steps are
for you to run):

1. **Booking reminders** — Settings → Booking Reminders: add as many rules as
   you like (e.g. 10 days before, 3 days before), each fully customisable
   (subject/message, on/off). Sent automatically, once per booking per rule,
   by a daily Worker cron job — nothing to click.
2. **Custom email** — a "Send Email" button on each customer's page (one-off),
   plus a new **Tools** sidebar item → Emails page for blasting an
   announcement to everyone (or a hand-picked list) or scheduling a
   newsletter for a future date.
3. **Booking deposits** — Preset Jobs now has a "Require a deposit to book"
   toggle per job (fixed £ or %), with a garage-wide default in Settings →
   Booking Deposits.

All emails go out via the same Resend account already used for licence
emails, but the "From" name and "Reply-To" show the garage's own name/email,
so customer replies land with the garage, not GarageDash.

## 1. Run the migration

Supabase dashboard → SQL Editor → paste and run:

`GarageDash-Backend/migrations/0011_reminders_deposits_emails.sql`

Idempotent — safe to re-run.

## 2. Deploy the Worker

```
cd ~/Documents/Claude/Projects/GarageLY/GarageDash-Worker
npm install
npx wrangler deploy
```

This also registers the new **Cron Trigger** (`0 7 * * *` — 07:00 UTC daily,
edit in `wrangler.toml` under `[triggers]` if you want a different time) that
sends due reminders + scheduled newsletters.

No new secrets needed — it reuses `RESEND_API_KEY` / `RESEND_FROM` (already
set) and `ADMIN_SECRET` (already set, now also guards a manual
`POST /run-reminders-now` endpoint you can hit if you ever want to trigger
the daily job without waiting, e.g. via curl:
`curl -X POST https://garagely-backend.<sub>.workers.dev/run-reminders-now -H "X-Admin-Secret: <your ADMIN_SECRET>"`).

**Cron Triggers need Wrangler to see them once** — if `wrangler deploy`
reports the trigger was added, you're done. If your Cloudflare account is on
a plan where Cron Triggers aren't available, the manual `/run-reminders-now`
endpoint above is a fallback — point any external "ping this URL daily"
service (e.g. a free cron-job.org account) at it with the `X-Admin-Secret`
header.

## 3. Build & deploy the web app

```
cd ~/Documents/Claude/Projects/GarageLY/GarageDash-Web
npm install
npm run build
wrangler pages deploy dist --project-name garagedash-app
```

(The desktop app picks up the same `../src` changes next time you build/ship
a release — no separate code to touch.)

## 4. Quick sanity check

- **Settings → Booking Reminders** — add a rule (e.g. 3 days before), hit
  **Test** — an email should land in your business inbox within a minute.
- **Preset Jobs** — edit a job, tick "Require a deposit to book", save — the
  card should show the deposit badge.
- **Customer page** → **Send Email** — send yourself a one-off email.
- **Tools** (sidebar) → **New Email** → pick "All customers" → **Send Now** —
  confirms the campaign path end-to-end.
- Book a test appointment 3 days out on a customer with your own email, then
  either wait for the 07:00 cron or hit `/run-reminders-now` — you should get
  the reminder.

## Notes / things worth knowing

- Reminders and scheduled newsletters run once a day, so "scheduled for
  2pm" really means "goes out the next time the daily job runs on or after
  that time" — not to-the-minute delivery. Fine for reminders/newsletters;
  worth knowing if you expect precise timing later.
- A booking reminder rule only ever fires once per booking (enforced by a
  unique index), so it's safe to hit "Test"/"Send Now" or re-run the cron
  without double-emailing anyone.
- Deposits live on the preset job (the template) *and* independently on each
  actual job/booking once created — editing a preset afterwards won't change
  deposits already set on existing jobs.
