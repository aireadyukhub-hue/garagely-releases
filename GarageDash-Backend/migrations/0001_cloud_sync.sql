-- ============================================================================
-- GarageDash — Cloud Sync Migration 0001
-- Multi-tenant business data (jobs, customers, vehicles, invoices, quotes,
-- bookings, parts, settings) with per-garage isolation + RLS.
--
-- Apply in: Supabase dashboard → SQL Editor → New query → paste → Run.
-- Idempotent: safe to run more than once.
--
-- Builds on the existing `licences` / `activation_log` tables (do not drop).
-- ============================================================================

-- ── Shared updated_at trigger fn (already exists from licences schema; re-create safe)
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ============================================================================
-- 1. TENANCY TABLES
-- ============================================================================

create table if not exists garages (
  id          bigint generated always as identity primary key,
  name        text not null default 'My Garage',
  licence_key text references licences(key),
  is_demo     boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index if not exists idx_garages_licence_key on garages(licence_key);

-- Maps a Supabase Auth user to the garage they belong to.
create table if not exists garage_members (
  user_id    uuid not null references auth.users(id) on delete cascade,
  garage_id  bigint not null references garages(id) on delete cascade,
  role       text not null default 'owner',
  created_at timestamptz not null default now(),
  primary key (user_id, garage_id)
);
create index if not exists idx_garage_members_user on garage_members(user_id);

-- Resolve "which garage is the current user" — used by every RLS policy.
create or replace function current_garage_id()
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select garage_id from garage_members where user_id = auth.uid() limit 1
$$;

-- ============================================================================
-- 2. BUSINESS TABLES (mirror of the desktop sql.js schema + garage_id)
-- ============================================================================

create table if not exists settings (
  id            bigint generated always as identity primary key,
  garage_id     bigint not null unique references garages(id) on delete cascade,
  business_name text default 'My Garage',
  address       text default '',
  phone         text default '',
  email         text default '',
  vat_number    text default '',
  vat_rate      real default 20,
  labour_rate   real default 65,
  invoice_prefix text default 'INV',
  invoice_next   integer default 1001,
  quote_prefix   text default 'QUO',
  quote_next     integer default 1001,
  currency      text default 'GBP',
  updated_at    timestamptz default now()
);

create table if not exists customers (
  id          bigint generated always as identity primary key,
  garage_id   bigint not null references garages(id) on delete cascade,
  first_name  text not null,
  last_name   text not null,
  email       text,
  phone       text,
  mobile      text,
  address     text,
  city        text,
  postcode    text,
  notes       text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);
create index if not exists idx_customers_garage on customers(garage_id);

create table if not exists vehicles (
  id           bigint generated always as identity primary key,
  garage_id    bigint not null references garages(id) on delete cascade,
  customer_id  bigint not null references customers(id) on delete cascade,
  registration text not null,
  make         text not null,
  model        text not null,
  year         integer,
  colour       text,
  vin          text,
  engine_size  text,
  fuel_type    text,
  mileage      integer,
  mot_due      text,
  service_due  text,
  notes        text,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);
create index if not exists idx_vehicles_garage on vehicles(garage_id);
create index if not exists idx_vehicles_customer on vehicles(customer_id);

create table if not exists parts (
  id             bigint generated always as identity primary key,
  garage_id      bigint not null references garages(id) on delete cascade,
  sku            text,
  name           text not null,
  description    text,
  supplier       text,
  cost_price     real not null default 0,
  sale_price     real not null default 0,
  stock_quantity integer default 0,
  min_stock      integer default 2,
  location       text,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);
create index if not exists idx_parts_garage on parts(garage_id);

create table if not exists jobs (
  id              bigint generated always as identity primary key,
  garage_id       bigint not null references garages(id) on delete cascade,
  job_number      text not null,
  customer_id     bigint not null references customers(id),
  vehicle_id      bigint not null references vehicles(id),
  status          text not null default 'booked',
  title           text not null,
  description     text,
  technician_notes text,
  assigned_to     text,
  estimated_hours real default 0,
  labour_rate     real default 65,
  booked_date     text,
  started_date    text,
  completed_date  text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  unique (garage_id, job_number)
);
create index if not exists idx_jobs_garage on jobs(garage_id);

create table if not exists job_line_items (
  id          bigint generated always as identity primary key,
  garage_id   bigint not null references garages(id) on delete cascade,
  job_id      bigint not null references jobs(id) on delete cascade,
  type        text not null default 'labour',
  description text not null,
  quantity    real default 1,
  unit_price  real not null,
  total       real not null,
  part_id     bigint references parts(id),
  created_at  timestamptz default now()
);
create index if not exists idx_job_line_items_job on job_line_items(job_id);

create table if not exists invoices (
  id             bigint generated always as identity primary key,
  garage_id      bigint not null references garages(id) on delete cascade,
  invoice_number text not null,
  job_id         bigint references jobs(id),
  customer_id    bigint not null references customers(id),
  status         text not null default 'draft',
  subtotal       real not null default 0,
  vat_rate       real default 20,
  vat_amount     real not null default 0,
  total          real not null default 0,
  notes          text,
  due_date       text,
  paid_date      text,
  payment_method text,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now(),
  unique (garage_id, invoice_number)
);
create index if not exists idx_invoices_garage on invoices(garage_id);

create table if not exists invoice_line_items (
  id          bigint generated always as identity primary key,
  garage_id   bigint not null references garages(id) on delete cascade,
  invoice_id  bigint not null references invoices(id) on delete cascade,
  description text not null,
  quantity    real default 1,
  unit_price  real not null,
  total       real not null
);
create index if not exists idx_invoice_line_items_invoice on invoice_line_items(invoice_id);

create table if not exists quotes (
  id               bigint generated always as identity primary key,
  garage_id        bigint not null references garages(id) on delete cascade,
  quote_number     text not null,
  customer_id      bigint not null references customers(id),
  vehicle_id       bigint references vehicles(id),
  status           text not null default 'draft',
  title            text,
  subtotal         real default 0,
  vat_rate         real default 20,
  vat_amount       real default 0,
  total            real default 0,
  notes            text,
  valid_until      text,
  converted_job_id bigint references jobs(id),
  created_at       timestamptz default now(),
  updated_at       timestamptz default now(),
  unique (garage_id, quote_number)
);
create index if not exists idx_quotes_garage on quotes(garage_id);

create table if not exists quote_line_items (
  id          bigint generated always as identity primary key,
  garage_id   bigint not null references garages(id) on delete cascade,
  quote_id    bigint not null references quotes(id) on delete cascade,
  description text not null,
  quantity    real default 1,
  unit_price  real not null,
  total       real not null
);
create index if not exists idx_quote_line_items_quote on quote_line_items(quote_id);

create table if not exists bookings (
  id          bigint generated always as identity primary key,
  garage_id   bigint not null references garages(id) on delete cascade,
  customer_id bigint references customers(id),
  vehicle_id  bigint references vehicles(id),
  job_id      bigint references jobs(id),
  title       text not null,
  start_time  text not null,
  end_time    text not null,
  notes       text,
  status      text default 'confirmed',
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);
create index if not exists idx_bookings_garage on bookings(garage_id);

-- updated_at triggers
do $$
declare t text;
begin
  foreach t in array array['settings','customers','vehicles','parts','jobs','invoices','quotes','bookings','garages']
  loop
    execute format('drop trigger if exists %1$s_updated_at on %1$s', t);
    execute format('create trigger %1$s_updated_at before update on %1$s for each row execute function update_updated_at()', t);
  end loop;
end $$;

-- ============================================================================
-- 3. ROW LEVEL SECURITY  — each garage sees only its own rows
-- ============================================================================

do $$
declare t text;
begin
  foreach t in array array[
    'settings','customers','vehicles','parts','jobs','job_line_items',
    'invoices','invoice_line_items','quotes','quote_line_items','bookings'
  ]
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

-- garages / garage_members: a user can read their own garage + membership
alter table garages enable row level security;
drop policy if exists garage_self on garages;
create policy garage_self on garages
  for select to authenticated
  using (id = current_garage_id());
drop policy if exists garage_self_update on garages;
create policy garage_self_update on garages
  for update to authenticated
  using (id = current_garage_id())
  with check (id = current_garage_id());

alter table garage_members enable row level security;
drop policy if exists member_self on garage_members;
create policy member_self on garage_members
  for select to authenticated
  using (user_id = auth.uid());

-- (All writes during account creation / demo seeding are done by the backend
--  using the service_role key, which bypasses RLS.)

-- ============================================================================
-- 4. AGGREGATE READ VIEWS  (security_invoker => RLS of caller applies)
-- ============================================================================

create or replace view customers_with_counts
with (security_invoker = true) as
  select c.*,
    count(distinct v.id) as vehicle_count,
    count(distinct j.id) as job_count
  from customers c
  left join vehicles v on v.customer_id = c.id
  left join jobs j     on j.customer_id = c.id
  group by c.id;

create or replace view jobs_with_totals
with (security_invoker = true) as
  select j.*,
    c.first_name, c.last_name,
    v.registration, v.make, v.model,
    coalesce(sum(li.total), 0) as total_value
  from jobs j
  left join customers c on c.id = j.customer_id
  left join vehicles  v on v.id = j.vehicle_id
  left join job_line_items li on li.job_id = j.id
  group by j.id, c.first_name, c.last_name, v.registration, v.make, v.model;

-- ============================================================================
-- 5. RPCs — atomic numbering on create, plus dashboard/report aggregates.
--    SECURITY INVOKER (default) so RLS applies and garage_id is enforced.
-- ============================================================================

-- next number helpers (atomic per-row increment on settings)
create or replace function next_invoice_number()
returns text language plpgsql as $$
declare pfx text; nxt integer;
begin
  update settings set invoice_next = invoice_next + 1
   where garage_id = current_garage_id()
   returning invoice_prefix, invoice_next - 1 into pfx, nxt;
  return pfx || '-' || nxt;
end $$;

create or replace function next_quote_number()
returns text language plpgsql as $$
declare pfx text; nxt integer;
begin
  update settings set quote_next = quote_next + 1
   where garage_id = current_garage_id()
   returning quote_prefix, quote_next - 1 into pfx, nxt;
  return pfx || '-' || nxt;
end $$;

create or replace function next_job_number()
returns text language plpgsql as $$
declare n integer;
begin
  select coalesce(max(cast(split_part(job_number,'-',2) as integer)), 0) + 1
    into n from jobs where garage_id = current_garage_id();
  return 'JOB-' || lpad(n::text, 4, '0');
end $$;

-- create_job(payload) -> returns the new job joined with customer/vehicle
create or replace function create_job(p jsonb)
returns setof jobs_with_totals language plpgsql as $$
declare new_id bigint; g bigint := current_garage_id();
begin
  insert into jobs (garage_id, job_number, customer_id, vehicle_id, status, title,
                    description, assigned_to, labour_rate, booked_date)
  values (g, next_job_number(),
          (p->>'customer_id')::bigint, (p->>'vehicle_id')::bigint,
          coalesce(p->>'status','booked'), p->>'title', p->>'description',
          p->>'assigned_to', coalesce((p->>'labour_rate')::real, 65), p->>'booked_date')
  returning id into new_id;
  return query select * from jobs_with_totals where id = new_id;
end $$;

-- create_invoice(payload, line_items[])
create or replace function create_invoice(p jsonb, items jsonb default '[]')
returns setof invoices language plpgsql as $$
declare new_id bigint; g bigint := current_garage_id(); it jsonb;
begin
  insert into invoices (garage_id, invoice_number, job_id, customer_id, status,
                        subtotal, vat_rate, vat_amount, total, notes, due_date)
  values (g, next_invoice_number(), (p->>'job_id')::bigint, (p->>'customer_id')::bigint,
          coalesce(p->>'status','draft'), coalesce((p->>'subtotal')::real,0),
          coalesce((p->>'vat_rate')::real,20), coalesce((p->>'vat_amount')::real,0),
          coalesce((p->>'total')::real,0), p->>'notes', p->>'due_date')
  returning id into new_id;
  for it in select * from jsonb_array_elements(items) loop
    insert into invoice_line_items (garage_id, invoice_id, description, quantity, unit_price, total)
    values (g, new_id, it->>'description', coalesce((it->>'quantity')::real,1),
            (it->>'unit_price')::real, (it->>'total')::real);
  end loop;
  return query select * from invoices where id = new_id;
end $$;

-- create_quote(payload, line_items[])
create or replace function create_quote(p jsonb, items jsonb default '[]')
returns setof quotes language plpgsql as $$
declare new_id bigint; g bigint := current_garage_id(); it jsonb;
begin
  insert into quotes (garage_id, quote_number, customer_id, vehicle_id, status, title,
                      subtotal, vat_rate, vat_amount, total, notes, valid_until)
  values (g, next_quote_number(), (p->>'customer_id')::bigint, (p->>'vehicle_id')::bigint,
          coalesce(p->>'status','draft'), p->>'title', coalesce((p->>'subtotal')::real,0),
          coalesce((p->>'vat_rate')::real,20), coalesce((p->>'vat_amount')::real,0),
          coalesce((p->>'total')::real,0), p->>'notes', p->>'valid_until')
  returning id into new_id;
  for it in select * from jsonb_array_elements(items) loop
    insert into quote_line_items (garage_id, quote_id, description, quantity, unit_price, total)
    values (g, new_id, it->>'description', coalesce((it->>'quantity')::real,1),
            (it->>'unit_price')::real, (it->>'total')::real);
  end loop;
  return query select * from quotes where id = new_id;
end $$;

create or replace function convert_quote_to_job(p_quote_id bigint)
returns setof jobs language plpgsql as $$
declare new_id bigint; g bigint := current_garage_id(); q record;
begin
  select * into q from quotes where id = p_quote_id and garage_id = g;
  insert into jobs (garage_id, job_number, customer_id, vehicle_id, status, title, labour_rate)
  values (g, next_job_number(), q.customer_id, q.vehicle_id, 'booked', q.title, 65)
  returning id into new_id;
  update quotes set status = 'converted', converted_job_id = new_id where id = p_quote_id;
  return query select * from jobs where id = new_id;
end $$;

-- save_job_line_items: replace all line items for a job
create or replace function save_job_line_items(p_job_id bigint, items jsonb)
returns setof job_line_items language plpgsql as $$
declare g bigint := current_garage_id(); it jsonb;
begin
  delete from job_line_items where job_id = p_job_id and garage_id = g;
  for it in select * from jsonb_array_elements(items) loop
    insert into job_line_items (garage_id, job_id, type, description, quantity, unit_price, total, part_id)
    values (g, p_job_id, coalesce(it->>'type','labour'), it->>'description',
            coalesce((it->>'quantity')::real,1), (it->>'unit_price')::real,
            (it->>'total')::real, nullif(it->>'part_id','')::bigint);
  end loop;
  return query select * from job_line_items where job_id = p_job_id order by id;
end $$;

-- dashboard_data() -> single jsonb blob (RLS-scoped via security invoker)
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
        where v.mot_due is not null and v.mot_due <= to_char(now()+interval '30 days','YYYY-MM-DD')
        order by v.mot_due) v),
    'serviceAlerts', (select coalesce(jsonb_agg(v),'[]') from (
        select v.*, c.first_name, c.last_name from vehicles v join customers c on c.id=v.customer_id
        where v.service_due is not null and v.service_due <= to_char(now()+interval '30 days','YYYY-MM-DD')
        order by v.service_due) v),
    'recentJobs', (select coalesce(jsonb_agg(j),'[]') from (
        select j.*, c.first_name, c.last_name, v.registration, v.make, v.model
        from jobs j left join customers c on c.id=j.customer_id
        left join vehicles v on v.id=j.vehicle_id order by j.updated_at desc limit 5) j),
    'jobStatusCounts', (select coalesce(jsonb_agg(s),'[]') from (
        select status, count(*) as count from jobs group by status) s)
  );
$$;

create or replace function report_revenue(p_from text, p_to text)
returns jsonb language sql stable as $$
  select jsonb_build_object(
    'daily', (select coalesce(jsonb_agg(r),'[]') from (
        select paid_date as date, sum(total) as revenue, count(*) as invoice_count
        from invoices where status='paid' and paid_date between p_from and p_to
        group by paid_date order by paid_date) r),
    'byStatus', (select coalesce(jsonb_agg(r),'[]') from (
        select status, count(*) as count, sum(total) as total from invoices
        where left(created_at::text,10) between p_from and p_to group by status) r),
    'total', (select coalesce(sum(total),0) from invoices
        where status='paid' and paid_date between p_from and p_to)
  );
$$;

create or replace function report_jobs(p_from text, p_to text)
returns jsonb language sql stable as $$
  select jsonb_build_object(
    'byStatus', (select coalesce(jsonb_agg(r),'[]') from (
        select status, count(*) as count from jobs
        where left(created_at::text,10) between p_from and p_to group by status) r),
    'byTechnician', (select coalesce(jsonb_agg(r),'[]') from (
        select assigned_to, count(*) as count from jobs
        where left(created_at::text,10) between p_from and p_to group by assigned_to) r),
    'recent', (select coalesce(jsonb_agg(r),'[]') from (
        select j.*, c.first_name, c.last_name, v.registration
        from jobs j left join customers c on c.id=j.customer_id
        left join vehicles v on v.id=j.vehicle_id
        where left(j.created_at::text,10) between p_from and p_to
        order by j.created_at desc) r)
  );
$$;

-- ============================================================================
-- 6. DEMO MODE
-- ============================================================================

-- end_demo_mode(): wipe this garage's business data, reset counters, clear flag.
create or replace function end_demo_mode()
returns void language plpgsql security invoker as $$
declare g bigint := current_garage_id();
begin
  delete from bookings           where garage_id = g;
  delete from invoice_line_items where garage_id = g;
  delete from invoices           where garage_id = g;
  delete from quote_line_items   where garage_id = g;
  delete from quotes             where garage_id = g;
  delete from job_line_items     where garage_id = g;
  delete from jobs               where garage_id = g;
  delete from vehicles           where garage_id = g;
  delete from customers          where garage_id = g;
  delete from parts              where garage_id = g;
  update settings set invoice_next = 1001, quote_next = 1001 where garage_id = g;
  update garages set is_demo = false where id = g;
end $$;

-- seed_demo_data(garage_id): populate a fresh garage with representative demo
-- data. Called by the backend (service role) right after account creation.
create or replace function seed_demo_data(g bigint)
returns void language plpgsql security definer set search_path = public as $$
declare
  c1 bigint; c2 bigint; c3 bigint; c4 bigint;
  v1 bigint; v2 bigint; v3 bigint; v4 bigint; v5 bigint;
  p1 bigint; p2 bigint; p3 bigint; p4 bigint; p5 bigint; p6 bigint; p7 bigint; p8 bigint;
  j1 bigint; j2 bigint; j3 bigint; j4 bigint; j5 bigint;
begin
  insert into settings (garage_id, business_name, address, phone, email, vat_number, vat_rate, labour_rate)
  values (g, 'Apex Auto Services', '14 Industrial Way, Birmingham', '0121 456 7890', 'info@apexauto.co.uk', 'GB123456789', 20, 65)
  on conflict (garage_id) do nothing;

  insert into customers (garage_id, first_name, last_name, email, phone, mobile, address, city, postcode, notes) values
    (g,'James','Harrison','james.h@email.com','0121 234 5678','07700 900001','12 Oak Street','Birmingham','B1 1AA','Regular customer, prefers morning appointments') returning id into c1;
  insert into customers (garage_id, first_name, last_name, email, phone, mobile, address, city, postcode, notes) values
    (g,'Sarah','Mitchell','sarah.m@gmail.com','','07700 900002','45 Maple Avenue','Solihull','B91 2BB','Fleet account - 2 vehicles') returning id into c2;
  insert into customers (garage_id, first_name, last_name, email, phone, mobile, address, city, postcode, notes) values
    (g,'David','Clarke','d.clarke@work.com','0121 876 5432','07700 900003','8 Elm Close','Birmingham','B15 3CC','') returning id into c3;
  insert into customers (garage_id, first_name, last_name, email, phone, mobile, address, city, postcode, notes) values
    (g,'Emma','Thompson','emma.t@email.co.uk','','07700 900004','22 Pine Road','Coventry','CV1 4DD','Referred by James Harrison') returning id into c4;

  insert into vehicles (garage_id, customer_id, registration, make, model, year, colour, fuel_type, mileage, mot_due, service_due) values
    (g,c1,'BD21 XYZ','Ford','Focus',2021,'Silver','Petrol',34200, to_char(now()+interval '20 days','YYYY-MM-DD'), to_char(now()+interval '60 days','YYYY-MM-DD')) returning id into v1;
  insert into vehicles (garage_id, customer_id, registration, make, model, year, colour, fuel_type, mileage, mot_due, service_due) values
    (g,c2,'SL19 ABC','Volkswagen','Golf',2019,'Blue','Diesel',67800, to_char(now()+interval '10 days','YYYY-MM-DD'), to_char(now()+interval '15 days','YYYY-MM-DD')) returning id into v2;
  insert into vehicles (garage_id, customer_id, registration, make, model, year, colour, fuel_type, mileage, mot_due, service_due) values
    (g,c2,'SL20 DEF','Vauxhall','Astra',2020,'White','Petrol',45100, to_char(now()+interval '120 days','YYYY-MM-DD'), to_char(now()+interval '150 days','YYYY-MM-DD')) returning id into v3;
  insert into vehicles (garage_id, customer_id, registration, make, model, year, colour, fuel_type, mileage, mot_due, service_due) values
    (g,c3,'DC15 GHI','BMW','3 Series',2015,'Black','Diesel',98500, to_char(now()+interval '5 days','YYYY-MM-DD'), to_char(now()+interval '25 days','YYYY-MM-DD')) returning id into v4;
  insert into vehicles (garage_id, customer_id, registration, make, model, year, colour, fuel_type, mileage, mot_due, service_due) values
    (g,c4,'ET22 JKL','Hyundai','Tucson',2022,'Red','Hybrid',18900, to_char(now()+interval '200 days','YYYY-MM-DD'), to_char(now()+interval '90 days','YYYY-MM-DD')) returning id into v5;

  insert into parts (garage_id, sku, name, description, supplier, cost_price, sale_price, stock_quantity, min_stock) values
    (g,'OIL-5W30','Engine Oil 5W-30 5L','Fully synthetic','Euro Car Parts',18.50,32.00,24,10) returning id into p1;
  insert into parts (garage_id, sku, name, description, supplier, cost_price, sale_price, stock_quantity, min_stock) values
    (g,'OIL-FILT-01','Oil Filter - Universal','Fits most VAG/Ford','Euro Car Parts',4.20,9.99,15,8) returning id into p2;
  insert into parts (garage_id, sku, name, description, supplier, cost_price, sale_price, stock_quantity, min_stock) values
    (g,'BRK-PAD-FR','Front Brake Pads - Set','OEM spec','GSF Car Parts',22.00,45.00,8,4) returning id into p3;
  insert into parts (garage_id, sku, name, description, supplier, cost_price, sale_price, stock_quantity, min_stock) values
    (g,'BRK-DSC-FR','Front Brake Disc - Each','Vented','GSF Car Parts',35.00,65.00,4,2) returning id into p4;
  insert into parts (garage_id, sku, name, description, supplier, cost_price, sale_price, stock_quantity, min_stock) values
    (g,'AIR-FILT-01','Air Filter - Panel','High flow','Euro Car Parts',8.50,18.00,12,5) returning id into p5;
  insert into parts (garage_id, sku, name, description, supplier, cost_price, sale_price, stock_quantity, min_stock) values
    (g,'BATT-075','Battery 075 - 70Ah','3yr warranty','Euro Car Parts',65.00,110.00,3,2) returning id into p6;
  insert into parts (garage_id, sku, name, description, supplier, cost_price, sale_price, stock_quantity, min_stock) values
    (g,'TIMING-BELT','Timing Belt Kit','Belt + tensioner + pulley','GSF Car Parts',55.00,95.00,2,1) returning id into p7;
  insert into parts (garage_id, sku, name, description, supplier, cost_price, sale_price, stock_quantity, min_stock) values
    (g,'TYRE-195-65R15','Tyre 195/65 R15 - Each','Budget brand','Tyre King',42.00,75.00,8,4) returning id into p8;

  insert into jobs (garage_id, job_number, customer_id, vehicle_id, status, title, description, technician_notes, assigned_to, labour_rate, booked_date, started_date, completed_date) values
    (g,'JOB-0001',c1,v1,'complete','Full Service','Annual full service','Oil and filter changed. Air filter replaced.','Dan',65, to_char(now()-interval '14 days','YYYY-MM-DD'), to_char(now()-interval '14 days','YYYY-MM-DD'), to_char(now()-interval '13 days','YYYY-MM-DD')) returning id into j1;
  insert into jobs (garage_id, job_number, customer_id, vehicle_id, status, title, description, technician_notes, assigned_to, labour_rate, booked_date, started_date, completed_date) values
    (g,'JOB-0002',c2,v2,'invoiced','Front Brake Pads & Discs','Replace front pads and discs - worn','Both sides done. Handbrake adjusted.','Steve',65, to_char(now()-interval '10 days','YYYY-MM-DD'), to_char(now()-interval '10 days','YYYY-MM-DD'), to_char(now()-interval '9 days','YYYY-MM-DD')) returning id into j2;
  insert into jobs (garage_id, job_number, customer_id, vehicle_id, status, title, description, technician_notes, assigned_to, labour_rate, booked_date, started_date) values
    (g,'JOB-0003',c3,v4,'in_progress','Timing Belt Replacement','Timing belt due at 100k','Water pump also being replaced','Dan',65, to_char(now(),'YYYY-MM-DD'), to_char(now(),'YYYY-MM-DD')) returning id into j3;
  insert into jobs (garage_id, job_number, customer_id, vehicle_id, status, title, description, assigned_to, labour_rate, booked_date) values
    (g,'JOB-0004',c4,v5,'booked','Full Service','Customer requested full service','Steve',65, to_char(now()+interval '2 days','YYYY-MM-DD')) returning id into j4;
  insert into jobs (garage_id, job_number, customer_id, vehicle_id, status, title, description, technician_notes, assigned_to, labour_rate, booked_date, started_date, completed_date) values
    (g,'JOB-0005',c2,v3,'complete','MOT + Brake Repair','MOT failed on brakes','Passed after pads replaced','Dan',65, to_char(now()-interval '7 days','YYYY-MM-DD'), to_char(now()-interval '7 days','YYYY-MM-DD'), to_char(now()-interval '6 days','YYYY-MM-DD')) returning id into j5;

  insert into job_line_items (garage_id, job_id, type, description, quantity, unit_price, total, part_id) values
    (g,j1,'labour','Full service - labour',1.5,65,97.50,null),
    (g,j1,'part','Engine Oil 5W-30 5L',1,32.00,32.00,p1),
    (g,j1,'part','Oil Filter',1,9.99,9.99,p2),
    (g,j1,'part','Air Filter',1,18.00,18.00,p5),
    (g,j2,'labour','Front brake pads & discs - labour',2,65,130.00,null),
    (g,j2,'part','Front Brake Pads - Set',1,45.00,45.00,p3),
    (g,j2,'part','Front Brake Disc x2',2,65.00,130.00,p4),
    (g,j3,'labour','Timing belt replacement - labour',4,65,260.00,null),
    (g,j3,'part','Timing Belt Kit',1,95.00,95.00,p7),
    (g,j5,'labour','MOT Test',1,54.85,54.85,null),
    (g,j5,'part','Front Brake Pads - Set',1,45.00,45.00,p3);

  insert into invoices (garage_id, invoice_number, job_id, customer_id, status, subtotal, vat_rate, vat_amount, total, due_date, paid_date) values
    (g,'INV-1001',j1,c1,'paid',157.49,20,31.50,188.99, to_char(now()-interval '7 days','YYYY-MM-DD'), to_char(now()-interval '6 days','YYYY-MM-DD')),
    (g,'INV-1002',j2,c2,'unpaid',305.00,20,61.00,366.00, to_char(now()+interval '7 days','YYYY-MM-DD'), null),
    (g,'INV-1003',j5,c2,'paid',99.85,20,19.97,119.82, to_char(now()-interval '1 day','YYYY-MM-DD'), to_char(now(),'YYYY-MM-DD'));

  insert into quotes (garage_id, quote_number, customer_id, vehicle_id, status, title, subtotal, vat_rate, vat_amount, total, valid_until) values
    (g,'QUO-1001',c3,v4,'sent','Clutch Replacement',420.00,20,84.00,504.00, to_char(now()+interval '14 days','YYYY-MM-DD')),
    (g,'QUO-1002',c4,v5,'draft','Annual Service Package',195.00,20,39.00,234.00, to_char(now()+interval '21 days','YYYY-MM-DD'));

  insert into bookings (garage_id, customer_id, vehicle_id, job_id, title, start_time, end_time, notes, status) values
    (g,c3,v4,j3,'Timing Belt - Clarke DC15 GHI', to_char(now(),'YYYY-MM-DD')||'T08:00:00', to_char(now(),'YYYY-MM-DD')||'T12:00:00','Allow 4 hours minimum','confirmed'),
    (g,c4,v5,j4,'Full Service - Thompson ET22 JKL', to_char(now()+interval '2 days','YYYY-MM-DD')||'T09:00:00', to_char(now()+interval '2 days','YYYY-MM-DD')||'T11:00:00','','confirmed'),
    (g,c1,v1,j1,'Full Service - Harrison BD21 XYZ', to_char(now()-interval '14 days','YYYY-MM-DD')||'T09:00:00', to_char(now()-interval '14 days','YYYY-MM-DD')||'T11:00:00','','completed');

  update settings set invoice_next = 1004, quote_next = 1003 where garage_id = g;
end $$;

-- Allow authenticated users to execute the RPCs they need.
grant execute on function current_garage_id, next_invoice_number, next_quote_number,
  next_job_number, create_job, create_invoice, create_quote, convert_quote_to_job,
  save_job_line_items, dashboard_data, report_revenue, report_jobs, end_demo_mode
  to authenticated;

-- ============================================================================
-- Done. Account creation / demo seeding is performed by the backend
-- (activate-account function) using the service_role key.
-- ============================================================================
