ALTER TABLE tw_invoice
    DROP COLUMN IF EXISTS payment_method,
    DROP COLUMN IF EXISTS receipt_no,
    DROP COLUMN IF EXISTS paid_at,
    DROP COLUMN IF EXISTS cashier_id;
