-- 000007_add_incidents.up.sql

CREATE TABLE IF NOT EXISTS incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id BIGINT NOT NULL REFERENCES organizations(id),
  reporter_user_id BIGINT NOT NULL REFERENCES users(id),
  incident_type VARCHAR(50) NOT NULL,
  description TEXT,
  lat NUMERIC(10,7),
  lng NUMERIC(10,7),
  photo_url TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'open',
  assigned_to BIGINT REFERENCES users(id),
  assigned_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  resolution_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS incidents_org_id_status_idx ON incidents(org_id, status);

ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS incidents_org_isolation ON incidents;
CREATE POLICY incidents_org_isolation ON incidents
  USING (
    current_setting('app.current_org_id', true) IS NULL
    OR current_setting('app.current_org_id', true) = ''
    OR org_id = current_setting('app.current_org_id', true)::bigint
  );
