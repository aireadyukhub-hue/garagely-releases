-- ============================================================================
-- GarageDash — Migration 0011
--   (1) Booking reminders: fully customisable rules (e.g. "10 days before",
--       "3 days before"), each with its own subject/message, sent
--       automatically by the Worker's daily cron via Resend.
--   (2) Custom email: a per-garage send log (one-off customer emails, booking
--       reminders and marketing campaigns all write here) + a campaigns table
--       for event blasts and scheduled newsletters.
--   (3) Booking deposits: configurable per preset job (fixed £ or %), plus
--       a garage-wide default so new presets don't start from zero, and the
--       actual deposit state lives on the job itself (so it can be edited or
--       marked paid without touching the preset template).
--
-- Apply via the Supabase SQL editor (sandbox can't reach Supabase).
-- Idempotent: safe to run more than once.
-- ============================================================================

-- ── (1) Settings: master switches + deposit defaults ─────────────────────────
alter table settings add column if not exists booking_reminders_enabled boolean default true;
alter table settings add column if not exists default_deposit_type  text default 'fixed' check (default_deposit_type in ('fixed','percent'));
alter table settings add column if not exists default_deposit_value real default 0;

-- ── (2) Preset jobs: per-job deposit configuration ────────────────────────────
alter table preset_jobs add column if not exists deposit_required boolean default false;
alter table preset_jobs add column if not exists deposit_type     text default 'fixed' check (deposit_type in ('fixed','percent'));
alter table preset_jobs add column if not exists deposit_value    real default 0;   -- £ if fixed, % (0-100) if percent

-- ── (3) Jobs: the actual deposit for a booked job (copied from the preset when
--     added, editable afterwards, independent of the template) ───────────────
alter table jobs add column if not exists deposit_required  boolean default false;
alter table jobs add column if not exists deposit_type      text default 'fixed' check (deposit_type in ('fixed','percent'));
alter table jobs add column if not exists deposit_value     real default 0;
alter table jobs add column if not exists deposit_paid      boolean default false;
alter table jobs add column if not exists deposit_paid_date text;

-- ── (4) Booking reminder rules — one or many per garage, e.g.
--        { days_before: 10, active: true }, { days_before: 3, active: true } ──
create table if not exists booking_reminder_rules (
  id          bigint generated always as identity primary key,
  garage_id   bigint not null references garages(id) on delete cascade,
  days_before integer not null default 3 check (days_before >= 0 and days_before <= 60),
  active      boolean not null default true,
  subject     text default '',   -- blank = use the built-in default template
  message     text default '',   -- blank = use the built-in default template
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);
create index if not exists idx_reminder_rules_garage on booking_reminder_rules(garage_id);

-- ── (5) Email campaigns — event blasts + scheduled newsletters ───────────────
create table if not exists email_campaigns (
  id               bigint generated always as identity primary key,
  garage_id        bigint not null references garages(id) on delete cascade,
  subject          text not null,
  body             text not null,                        -- supports {{first_name}} token
  audience         text not null default 'all' check (audience in ('all','custom')),
  audience_filter  jsonb default '{}',                    -- { customer_ids: [...] } when audience='custom'
  status           text not null default 'draft' check (status in ('draft','scheduled','sending','sent','failed','cancelled')),
  scheduled_at     timestamptz,                            -- null = send immediately via "Send Now"
  sent_at          timestamptz,
  recipient_count  integer default 0,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);
create index if not exists idx_email_campaigns_garage on email_campaigns(garage_id);
create index if not exists idx_email_campaigns_due on email_campaigns(status, scheduled_at);

-- ── (6) Unified send log — booking reminders, campaigns and one-off customer
--     emails all write here. Also used to stop a reminder rule firing twice
--     for the same booking. ────────────────────────────────────────────────
create table if not exists email_log (
  id           bigint generated always as identity primary key,
  garage_id    bigint not null references garages(id) on delete cascade,
  kind         text not null check (kind in ('custom','booking_reminder','campaign')),
  customer_id  bigint references customers(id) on delete set null,
  booking_id   bigint references bookings(id) on delete set null,
  rule_id      bigint references booking_reminder_rules(id) on delete set null,
  campaign_id  bigint references email_campaigns(id) on delete set null,
  to_email     text not null,
  subject      text not null,
  success      boolean not null default true,
  error        text,
  sent_at      timestamptz default now()
);
create index if not exists idx_email_log_garage on email_log(garage_id);
create index if not exists idx_email_log_campaign on email_log(campaign_id);

-- Belt-and-braces: a given rule can only ever log once against a given
-- booking, even if the daily cron and a manual "send now" race each other.
create unique index if not exists idx_email_log_booking_rule_once on email_log(booking_id, rule_id)
  where kind = 'booking_reminder' and booking_id is not null and rule_id is not null;

-- ── RLS — same garage-isolation pattern as every other business table ────────
do $$
declare t text;
begin
  foreach t in array array['booking_reminder_rules','email_campaigns','email_log']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists garage_isolation on %I', t);
    execute format($f$
      create policy garage_isolation on %I
        for all to authenticated
        using (garage_id = current_garage_id())
        with check (garage_id = current_garage_id())
    $f$, t);
  end loop;
end $$;

-- updated_at triggers (email_log is append-only, no trigger needed)
do $$
declare t text;
begin
  foreach t in array array['booking_reminder_rules','email_campaigns']
  loop
    execute format('drop trigger if exists %1$s_updated_at on %1$s', t);
    execute format('create trigger %1$s_updated_at before update on %1$s for each row execute function update_updated_at()', t);
  end loop;
end $$;

-- ============================================================================
-- Done. The Worker's daily cron (see GarageDash-Worker) reads
-- booking_reminder_rules + bookings + email_campaigns using the service-role
-- key (bypasses RLS) and writes results to email_log.
-- ============================================================================
