-- ============================================================================
-- GarageDash — Migration 0010
--   Technician Mode: a simple, non-auth "restricted view" toggle for shared
--   workshop devices. A technician using the tablet on the bay only needs
--   Calendar / Job Sheets / Customers / Vehicles / Inspections — not Reports,
--   Settings, pricing or financials.
--
--   Deliberately NOT a second Supabase Auth account / RLS change: the owner
--   sets a PIN once in Settings, then any device can be flipped into
--   Technician Mode. Leaving Technician Mode back to the full view requires
--   that PIN, so a technician can't just toggle it off themselves. The
--   on/off state itself lives in the browser's localStorage per device, not
--   in the database — only the PIN is shared/synced.
--
-- Apply via the Supabase SQL editor (sandbox can't reach Supabase).
-- ============================================================================

alter table settings add column if not exists tech_pin text default '';   -- '' = Technician Mode disabled entirely
