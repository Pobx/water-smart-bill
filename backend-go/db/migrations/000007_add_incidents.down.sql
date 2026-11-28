-- 000007_add_incidents.down.sql

DROP INDEX IF EXISTS incidents_org_id_status_idx;
DROP TABLE IF EXISTS incidents;
