-- 000005_add_payment_batches_debt_notices.up.sql

-- payment_batches
CREATE TABLE IF NOT EXISTS payment_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id BIGINT NOT NULL REFERENCES organizations(id),
  user_id BIGINT NOT NULL REFERENCES users(id),
  total_amount NUMERIC(12,2) NOT NULL,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  received_by BIGINT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE tw_acc_transactions
  ADD COLUMN IF NOT EXISTS batch_payment_id UUID REFERENCES payment_batches(id);

ALTER TABLE payment_batches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS payment_batches_org_isolation ON payment_batches;
CREATE POLICY payment_batches_org_isolation ON payment_batches
  USING (
    current_setting('app.current_org_id', true) IS NULL
    OR current_setting('app.current_org_id', true) = ''
    OR org_id = current_setting('app.current_org_id', true)::bigint
  );

-- debt_notices
CREATE TABLE IF NOT EXISTS debt_notices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id BIGINT NOT NULL REFERENCES organizations(id),
  user_id BIGINT NOT NULL REFERENCES users(id),
  invoice_ids BIGINT[] NOT NULL,
  total_overdue_amount NUMERIC(12,2) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  notice_sent_at TIMESTAMPTZ,
  cut_at TIMESTAMPTZ,
  cut_by BIGINT REFERENCES users(id),
  cut_meter_reading NUMERIC(10,2),
  restored_at TIMESTAMPTZ,
  restored_by BIGINT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE debt_notices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS debt_notices_org_isolation ON debt_notices;
CREATE POLICY debt_notices_org_isolation ON debt_notices
  USING (
    current_setting('app.current_org_id', true) IS NULL
    OR current_setting('app.current_org_id', true) = ''
    OR org_id = current_setting('app.current_org_id', true)::bigint
  );
