-- ============================================================================
-- GarageLY — Migration 0007 — Technician shift patterns.
--   Each technician has a default weekly pattern:
--     • work_days : which weekdays they normally work (e.g. ["mon","tue","wed"])
--     • start_time / end_time : their normal hours (e.g. 08:00–15:00)
--   The calendar shows a technician's dot only on their working days (that the
--   business is also open), and surfaces their hours. Day-specific time off
--   (0006 technician_time_off) still overrides this.
-- ============================================================================
alter table technicians add column if not exists work_days  jsonb default '["mon","tue","wed","thu","fri"]'::jsonb;
alter table technicians add column if not exists start_time text;
alter table technicians add column if not exists end_time   text;
