-- ============================================================================
-- GarageLY — Migration 0009
--   (1) Labour-times: preset_jobs.labour_hours — estimated labour hours so a
--       quote can auto-price labour at the garage's current rate.
--   (2) Digital inspections: per-vehicle checklist with a printable customer
--       report (inspections table; items stored as JSONB).
-- Apply via the Supabase SQL editor (sandbox can't reach Supabase).
-- ============================================================================

-- ── (1) labour hours on preset jobs ──────────────────────────────────────────
alter table preset_jobs add column if not exists labour_hours real default 0;

-- ── (2) digital inspections ──────────────────────────────────────────────────
create table if not exists inspections (
  id            bigint generated always as identity primary key,
  garage_id     bigint not null references garages(id) on delete cascade,
  vehicle_id    bigint references vehicles(id) on delete set null,
  customer_id   bigint references customers(id) on delete set null,
  job_id        bigint references jobs(id) on delete set null,
  technician_id bigint references technicians(id) on delete set null,
  status        text default 'in_progress',      -- 'in_progress' | 'complete'
  result        text default '',                 -- overall: 'pass' | 'advisory' | 'fail'
  mileage       integer,
  notes         text default '',
  -- items: [{ category, item, status: 'pass'|'advisory'|'fail'|'na', note }]
  items         jsonb default '[]'::jsonb,
  inspected_on  text default to_char(now(),'YYYY-MM-DD'),
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);
create index if not exists idx_inspections_garage  on inspections(garage_id);
create index if not exists idx_inspections_vehicle on inspections(vehicle_id);

alter table inspections enable row level security;
drop policy if exists garage_isolation on inspections;
create policy garage_isolation on inspections
  for all to authenticated
  using (garage_id = current_garage_id())
  with check (garage_id = current_garage_id());

drop trigger if exists inspections_updated_at on inspections;
create trigger inspections_updated_at before update on inspections
  for each row execute function update_updated_at();
