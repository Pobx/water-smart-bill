-- 000002_enable_rls.up.sql
-- Multi-tenant Row-Level Security (RLS) by org_id

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
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', tbl);
        EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_policy ON %I;', tbl);
        EXECUTE format(
            'CREATE POLICY tenant_isolation_policy ON %I USING (
                current_setting(''app.current_org_id'', true) IS NULL
                OR current_setting(''app.current_org_id'', true) = ''''
                OR org_id = current_setting(''app.current_org_id'', true)::bigint
            );',
            tbl
        );
    END LOOP;
END $$;
