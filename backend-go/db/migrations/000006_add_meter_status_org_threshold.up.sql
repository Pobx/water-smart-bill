-- 000006_add_meter_status_org_threshold.up.sql

ALTER TABLE tw_meter_infos DROP CONSTRAINT IF EXISTS tw_meter_infos_status_check;
ALTER TABLE tw_meter_infos ADD CONSTRAINT tw_meter_infos_status_check CHECK (status IN ('active', 'inactive', 'disconnected', 'deleted'));

ALTER TABLE tw_meter_infos ADD COLUMN IF NOT EXISTS debt_notice_id UUID REFERENCES debt_notices(id);

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS overdue_threshold INTEGER NOT NULL DEFAULT 2;
