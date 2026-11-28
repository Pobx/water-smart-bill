-- 000006_add_meter_status_org_threshold.down.sql

ALTER TABLE organizations DROP COLUMN IF EXISTS overdue_threshold;
ALTER TABLE tw_meter_infos DROP COLUMN IF EXISTS debt_notice_id;

ALTER TABLE tw_meter_infos DROP CONSTRAINT IF EXISTS tw_meter_infos_status_check;
ALTER TABLE tw_meter_infos ADD CONSTRAINT tw_meter_infos_status_check CHECK (status IN ('active', 'inactive', 'deleted'));
