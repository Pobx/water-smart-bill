-- 000005_add_payment_batches_debt_notices.down.sql

DROP POLICY IF EXISTS debt_notices_org_isolation ON debt_notices;
DROP TABLE IF EXISTS debt_notices;

ALTER TABLE tw_acc_transactions DROP COLUMN IF EXISTS batch_payment_id;

DROP POLICY IF EXISTS payment_batches_org_isolation ON payment_batches;
DROP TABLE IF EXISTS payment_batches;
