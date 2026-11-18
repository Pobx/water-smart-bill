-- 000002_enable_rls.down.sql

DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOREACH tbl IN ARRAY ARRAY[
        'zones',
        'subzones',
        'users',
        'tw_meter_types',
        'tw_meter_type_rate_configs',
        'invoice_period',
        'tw_meter_infos',
        'tw_acc_transactions',
        'tw_invoice'
    ]
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_policy ON %I;', tbl);
        EXECUTE format('ALTER TABLE %I DISABLE ROW LEVEL SECURITY;', tbl);
    END LOOP;
END $$;
