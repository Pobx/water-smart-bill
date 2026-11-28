-- 000004_add_meter_routes.up.sql
CREATE TABLE IF NOT EXISTS tw_meter_routes (
  id         BIGSERIAL PRIMARY KEY,
  org_id     BIGINT NOT NULL REFERENCES organizations(id),
  name       VARCHAR(100) NOT NULL,
  staff_id   BIGINT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE tw_meter_infos ADD COLUMN IF NOT EXISTS route_id BIGINT REFERENCES tw_meter_routes(id);

-- RLS: staff เห็นเฉพาะ route ของ org ตัวเอง
ALTER TABLE tw_meter_routes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tw_meter_routes_org_isolation ON tw_meter_routes;
CREATE POLICY tw_meter_routes_org_isolation ON tw_meter_routes
  USING (
    current_setting('app.current_org_id', true) IS NULL
    OR current_setting('app.current_org_id', true) = ''
    OR org_id = current_setting('app.current_org_id', true)::bigint
  );
