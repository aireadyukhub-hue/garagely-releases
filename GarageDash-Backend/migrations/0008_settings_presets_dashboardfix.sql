-- ============================================================================
-- GarageDash — Migration 0008
--   (1) Dashboard fix: don't raise MOT/service alerts when no date entered
--       (empty-string mot_due/service_due used to slip past the `is not null`
--       guard and compare as < any real date → false warnings).
--   (2) New settings columns: branding accent, documents/templates, business
--       defaults (payment terms, reminder lead time, etc).
--   (3) Preset (pre-quoted) jobs: a catalogue of common jobs with parts+labour
--       line items that can be multi-selected straight into a quote.
-- Apply via the Supabase SQL editor (sandbox can't reach Supabase).
-- ============================================================================

-- ── (1) dashboard_data: guard against empty-string dates ─────────────────────
create or replace function dashboard_data()
returns jsonb language sql stable as $$
  with today as (select to_char(now(),'YYYY-MM-DD') as d),
       month_start as (select to_char(date_trunc('month', now()),'YYYY-MM-DD') as d),
       last_month_start as (select to_char(date_trunc('month', now() - interval '1 month'),'YYYY-MM-DD') as d),
       last_month_end as (select to_char(date_trunc('month', now()) - interval '1 day','YYYY-MM-DD') as d)
  select jsonb_build_object(
    'todayBookings', (select coalesce(jsonb_agg(b),'[]') from (
        select b.*, c.first_name, c.last_name, v.registration, v.make, v.model
        from bookings b left join customers c on c.id=b.customer_id
        left join vehicles v on v.id=b.vehicle_id
        where left(b.start_time,10) = (select d from today) order by b.start_time) b),
    'jobsInProgress', (select coalesce(jsonb_agg(j),'[]') from (
        select j.*, c.first_name, c.last_name, v.registration, v.make, v.model
        from jobs j left join customers c on c.id=j.customer_id
        left join vehicles v on v.id=j.vehicle_id
        where j.status in ('in_progress','awaiting_parts') order by j.updated_at desc) j),
    'revenueThisMonth', (select coalesce(sum(total),0) from invoices
        where status='paid' and paid_date >= (select d from month_start)),
    'revenueLastMonth', (select coalesce(sum(total),0) from invoices
        where status='paid' and paid_date between (select d from last_month_start) and (select d from last_month_end)),
    'outstandingInvoices', (select jsonb_build_object('count',count(*),'total',coalesce(sum(total),0))
        from invoices where status='unpaid'),
    'motAlerts', (select coalesce(jsonb_agg(v),'[]') from (
        select v.*, c.first_name, c.last_name from vehicles v join customers c on c.id=v.customer_id
        where coalesce(v.mot_due,'') <> '' and v.mot_due ~ '^\d{4}-\d{2}-\d{2}'
          and v.mot_due <= to_char(now()+interval '30 days','YYYY-MM-DD')
        order by v.mot_due) v),
    'serviceAlerts', (select coalesce(jsonb_agg(v),'[]') from (
        select v.*, c.first_name, c.last_name from vehicles v join customers c on c.id=v.customer_id
        where coalesce(v.service_due,'') <> '' and v.service_due ~ '^\d{4}-\d{2}-\d{2}'
          and v.service_due <= to_char(now()+interval '30 days','YYYY-MM-DD')
        order by v.service_due) v),
    'recentJobs', (select coalesce(jsonb_agg(j),'[]') from (
        select j.*, c.first_name, c.last_name, v.registration, v.make, v.model
        from jobs j left join customers c on c.id=j.customer_id
        left join vehicles v on v.id=j.vehicle_id order by j.updated_at desc limit 5) j),
    'jobStatusCounts', (select coalesce(jsonb_agg(s),'[]') from (
        select status, count(*) as count from jobs group by status) s)
  );
$$;

-- ── (2) settings: branding, documents & business defaults ────────────────────
alter table settings add column if not exists accent_color    text   default '#F4A523';
alter table settings add column if not exists payment_terms   text   default '';        -- e.g. "Payment due within 14 days"
alter table settings add column if not exists bank_details    text   default '';        -- shown on invoices
alter table settings add column if not exists terms           text   default '';        -- terms & conditions
alter table settings add column if not exists quote_notes      text  default '';        -- default notes prefilled on new quotes
alter table settings add column if not exists invoice_notes    text  default '';        -- default notes prefilled on new invoices
alter table settings add column if not exists invoice_footer   text  default '';        -- footer line on printed invoices/quotes
alter table settings add column if not exists jobsheet_footer  text  default '';        -- footer line on printed job sheets
alter table settings add column if not exists reminder_lead_days integer default 30;    -- MOT/service alert lead time (days)
alter table settings add column if not exists ui_density       text   default 'comfortable'; -- 'comfortable' | 'compact'

-- ── (3) preset (pre-quoted) jobs ─────────────────────────────────────────────
create table if not exists preset_jobs (
  id          bigint generated always as identity primary key,
  garage_id   bigint not null references garages(id) on delete cascade,
  name        text not null,                 -- e.g. "Fit MQB intercooler"
  category    text default '',               -- optional grouping e.g. "Tuning"
  description text default '',
  active      boolean default true,
  sort_order  integer default 0,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);
create index if not exists idx_preset_jobs_garage on preset_jobs(garage_id);

create table if not exists preset_job_items (
  id             bigint generated always as identity primary key,
  garage_id      bigint not null references garages(id) on delete cascade,
  preset_job_id  bigint not null references preset_jobs(id) on delete cascade,
  type           text default 'part',        -- 'labour' | 'part' | 'other'
  description    text not null,
  quantity       real default 1,
  unit_price     real default 0,
  sort_order     integer default 0
);
create index if not exists idx_preset_job_items_preset on preset_job_items(preset_job_id);
create index if not exists idx_preset_job_items_garage  on preset_job_items(garage_id);

alter table preset_jobs      enable row level security;
alter table preset_job_items enable row level security;

drop policy if exists garage_isolation on preset_jobs;
create policy garage_isolation on preset_jobs
  for all to authenticated
  using (garage_id = current_garage_id())
  with check (garage_id = current_garage_id());

drop policy if exists garage_isolation on preset_job_items;
create policy garage_isolation on preset_job_items
  for all to authenticated
  using (garage_id = current_garage_id())
  with check (garage_id = current_garage_id());

drop trigger if exists preset_jobs_updated_at on preset_jobs;
create trigger preset_jobs_updated_at before update on preset_jobs
  for each row execute function update_updated_at();
