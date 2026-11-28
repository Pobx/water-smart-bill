-- 000004_add_meter_routes.down.sql
ALTER TABLE tw_meter_infos DROP COLUMN IF EXISTS route_id;
DROP TABLE IF EXISTS tw_meter_routes;
