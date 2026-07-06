-- ============================================================================
-- GarageDash — Migration 0004 — Suppliers list (per-garage, RLS).
-- ============================================================================
create table if not exists suppliers (
  id             bigint generated always as identity primary key,
  garage_id      bigint not null references garages(id) on delete cascade,
  name           text not null,
  contact_name   text,
  phone          text,
  email          text,
  website        text,
  address        text,
  account_number text,
  notes          text,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);
create index if not exists idx_suppliers_garage on suppliers(garage_id);

alter table suppliers enable row level security;
drop policy if exists garage_isolation on suppliers;
create policy garage_isolation on suppliers
  for all to authenticated
  using (garage_id = current_garage_id())
  with check (garage_id = current_garage_id());

drop trigger if exists suppliers_updated_at on suppliers;
create trigger suppliers_updated_at before update on suppliers
  for each row execute function update_updated_at();
