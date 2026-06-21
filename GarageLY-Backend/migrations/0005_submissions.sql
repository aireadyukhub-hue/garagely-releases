-- ============================================================================
-- GarageLY — Migration 0005 — Feedback / support submissions.
-- One table for both feedback/feature requests and support tickets; the admin
-- dashboard reads all rows via the service_role key (bypasses RLS).
-- ============================================================================
create table if not exists submissions (
  id            bigint generated always as identity primary key,
  garage_id     bigint not null references garages(id) on delete cascade,
  type          text not null default 'feedback',  -- feedback | support
  subject       text,
  message       text not null,
  status        text not null default 'new',       -- new | open | closed
  contact_email text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);
create index if not exists idx_submissions_garage on submissions(garage_id);
create index if not exists idx_submissions_status on submissions(status);

alter table submissions enable row level security;
drop policy if exists submission_own on submissions;
create policy submission_own on submissions
  for all to authenticated
  using (garage_id = current_garage_id())
  with check (garage_id = current_garage_id());

drop trigger if exists submissions_updated_at on submissions;
create trigger submissions_updated_at before update on submissions
  for each row execute function update_updated_at();
