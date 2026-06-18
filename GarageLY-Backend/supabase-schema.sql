-- GarageLY Supabase Schema
-- Run this in: Supabase dashboard → SQL Editor → New query

-- ─── Licences ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS licences (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key              TEXT NOT NULL UNIQUE,               -- GRLY-XXXX-XXXX-XXXX
  garage_name      TEXT NOT NULL DEFAULT 'My Garage',
  email            TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'trial'       -- trial | active | expired | cancelled
                     CHECK (status IN ('trial', 'active', 'expired', 'cancelled')),
  stripe_customer_id   TEXT,
  stripe_subscription_id TEXT,
  trial_ends_at    TIMESTAMPTZ,
  current_period_end   TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_licences_key    ON licences (key);
CREATE INDEX idx_licences_email  ON licences (email);
CREATE INDEX idx_licences_status ON licences (status);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER licences_updated_at
  BEFORE UPDATE ON licences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── Activation log (for auditing / abuse detection) ─────────────────────────

CREATE TABLE IF NOT EXISTS activation_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  licence_id   UUID REFERENCES licences(id) ON DELETE CASCADE,
  event        TEXT NOT NULL,   -- activated | deactivated | validation_ok | validation_fail
  metadata     JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_activation_log_licence ON activation_log (licence_id);
