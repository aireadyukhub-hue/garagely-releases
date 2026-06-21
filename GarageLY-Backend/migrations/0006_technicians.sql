-- ============================================================================
-- GarageLY — Migration 0006 — Technicians, rota (time-off), opening hours.
--   • technicians: the people on the team, each with a colour dot.
--   • technician_time_off: per-day EXCEPTIONS only (full day off / half day).
--       A technician is assumed working on every business open-day unless a
--       row here says otherwise. kind = 'off' (no dot) or 'half' (half circle).
--   • settings.opening_hours: per-weekday open/closed + times (drives which
--       days count as working days for the calendar dots).
--   • bookings.technician_id / jobs.technician_id: who the work is assigned to.
-- ============================================================================

-- ── technicians ─────────────────────────────────────────────────────────────
create table if not exists technicians (
  id          bigint generated always as identity primary key,
  garage_id   bigint not null references garages(id) on delete cascade,
  name        text not null,
  colour      text not null default '#F4A523',   -- hex colour for the calendar dot
  active      boolean not null default true,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);
create index if not exists idx_technicians_garage on technicians(garage_id);

alter table technicians enable row level security;
drop policy if exists technician_own on technicians;
create policy technician_own on technicians
  for all to authenticated
  using (garage_id = current_garage_id())
  with check (garage_id = current_garage_id());

drop trigger if exists technicians_updated_at on technicians;
create trigger technicians_updated_at before update on technicians
  for each row execute function update_updated_at();

-- ── technician_time_off (exceptions only) ───────────────────────────────────
create table if not exists technician_time_off (
  id             bigint generated always as identity primary key,
  garage_id      bigint not null references garages(id) on delete cascade,
  technician_id  bigint not null references technicians(id) on delete cascade,
  day            date not null,
  kind           text not null default 'off',   -- 'off' | 'half'
  note           text,
  created_at     timestamptz default now(),
  unique (technician_id, day)
);
create index if not exists idx_time_off_garage on technician_time_off(garage_id);
create index if not exists idx_time_off_day on technician_time_off(day);

alter table technician_time_off enable row level security;
drop policy if exists time_off_own on technician_time_off;
create policy time_off_own on technician_time_off
  for all to authenticated
  using (garage_id = current_garage_id())
  with check (garage_id = current_garage_id());

-- ── settings.opening_hours ──────────────────────────────────────────────────
-- JSON shape: { "mon": {"open": true, "from": "08:00", "to": "17:00"}, ... }
alter table settings add column if not exists opening_hours jsonb;

-- ── link work to a technician ───────────────────────────────────────────────
alter table bookings add column if not exists technician_id bigint references technicians(id) on delete set null;
alter table jobs     add column if not exists technician_id bigint references technicians(id) on delete set null;
create index if not exists idx_bookings_technician on bookings(technician_id);
create index if not exists idx_jobs_technician on jobs(technician_id);
