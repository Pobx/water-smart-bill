# P1 Debt Management + Bulk Payment + Daily Report Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** สร้าง Workflow การจัดการหนี้ค้างชำระแบบครบวงจร: (1) รวมบิลค้างหลายรอบชำระครั้งเดียว, (2) Admin สร้างใบแจ้งเตือนหนี้ที่ Resident เห็นได้จาก Dashboard, (3) Staff ตัดมิเตอร์ + เปิดคืน, (4) Finance Export รายงานรับชำระรายวัน Excel

**Architecture:** Backend เพิ่ม 2 DB migrations + 7 API endpoints ใหม่ Frontend เพิ่ม feature `debt-management` และ feature `reports` แบบ Vertical Slice Bulk payment ใช้ PostgreSQL transaction + idempotency key

**Tech Stack:** Go 1.24+, Echo v4, PostgreSQL (transaction), React 18, TypeScript, `SheetJS (xlsx)` สำหรับ Excel export

**Spec:** `docs/superpowers/specs/2026-11-28-new-features-design.md` (ตอบ Q1=UI-only, Q4=admin-configurable default 2 รอบ, Q5=plain table)

## Global Constraints

- Bulk payment ต้องใช้ `BEGIN...COMMIT` DB transaction — ถ้า payment record ใดล้มเหลว ต้อง rollback ทั้งหมด
- `debt_notices` และ `payment_batches` ต้องมี `org_id` ใน WHERE ทุก query (RLS + application level)
- ห้าม Staff ตัดมิเตอร์โดยไม่มี `debt_notice_id` ที่ status = `sent` อยู่ในระบบ
- Resident เห็น Debt Notice เฉพาะของตัวเอง (filter ด้วย `user_id = claims.sub`)
- Excel export ใช้ `SheetJS` บน Frontend เท่านั้น — Backend ส่งเป็น JSON ปกติ
- `overdue_threshold` ของ org เก็บใน `organizations` table (default = 2)
- ทุก migration ต่อเนื่องจาก `000004` → ใช้ `000005` และ `000006`

## Review Focus

- Bulk payment ที่ถูก retry (network timeout) → `batch_payment_id` ต้องป้องกัน double-pay (409 Conflict)
- Staff ที่ต้องการ restore meter โดยที่ยังค้างชำระอยู่ → ต้อง block (400 "outstanding balance remaining")
- Debt Notice ที่สร้างแล้ว แต่ถูก delete invoice → ต้อง handle FK constraint อย่าง graceful
- Finance export range ที่กว้างมาก (1 ปี) → ต้องมี limit 1,000 rows หรือ streaming pagination
- Resident dashboard แสดง Debt Notice ของ Resident คนอื่น → ต้องป้องกัน IDOR ด้วย org+user scope

---

## Task 1: DB Migrations — `payment_batches`, `debt_notices`, meter status, org threshold

**Files:**
- Create: `backend-go/db/migrations/000005_add_payment_batches_debt_notices.up.sql`
- Create: `backend-go/db/migrations/000005_add_payment_batches_debt_notices.down.sql`
- Create: `backend-go/db/migrations/000006_add_meter_status_org_threshold.up.sql`
- Create: `backend-go/db/migrations/000006_add_meter_status_org_threshold.down.sql`

**Interfaces:**
- Produces:
  - `payment_batches(id UUID PK, org_id, user_id, total_amount, paid_at, received_by)`
  - `payment_records.batch_payment_id UUID FK nullable`
  - `debt_notices(id UUID PK, org_id, user_id, invoice_ids UUID[], total_overdue_amount, status, notice_sent_at, cut_at, cut_by, cut_meter_reading, restored_at, restored_by)`
  - `tw_meter_infos.status VARCHAR(20) DEFAULT 'active'`
  - `organizations.overdue_threshold INT DEFAULT 2`

- [ ] **Step 1: เขียน 000005 up migration**

```sql
-- payment_batches
CREATE TABLE payment_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id BIGINT NOT NULL REFERENCES organizations(id),
  user_id BIGINT NOT NULL REFERENCES users(id),
  total_amount NUMERIC(12,2) NOT NULL,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  received_by BIGINT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(id)
);
ALTER TABLE payment_records ADD COLUMN batch_payment_id UUID REFERENCES payment_batches(id);

-- debt_notices  
CREATE TABLE debt_notices (
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
CREATE POLICY debt_notices_org_isolation ON debt_notices USING (org_id = current_setting('app.current_org_id')::BIGINT);
```

- [ ] **Step 2: เขียน 000005 down migration**

```sql
DROP TABLE IF EXISTS debt_notices;
ALTER TABLE payment_records DROP COLUMN IF EXISTS batch_payment_id;
DROP TABLE IF EXISTS payment_batches;
```

- [ ] **Step 3: เขียน 000006 up migration**

```sql
ALTER TABLE tw_meter_infos ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'active';
ALTER TABLE tw_meter_infos ADD COLUMN debt_notice_id UUID REFERENCES debt_notices(id);
ALTER TABLE organizations ADD COLUMN overdue_threshold INT NOT NULL DEFAULT 2;
```

- [ ] **Step 4: เขียน 000006 down migration**

```sql
ALTER TABLE tw_meter_infos DROP COLUMN IF EXISTS debt_notice_id;
ALTER TABLE tw_meter_infos DROP COLUMN IF EXISTS status;
ALTER TABLE organizations DROP COLUMN IF EXISTS overdue_threshold;
```

- [ ] **Step 5: Run test migrations** `cd backend-go && go test ./db/... -v`

- [ ] **Step 6: Commit**

```bash
git add backend-go/db/migrations/000005_* backend-go/db/migrations/000006_*
git commit -m "feat(db): add payment_batches, debt_notices, meter status, org overdue_threshold"
```

---

## Task 2: Backend — Bulk Payment API

**Files:**
- Modify: `backend-go/application/service.go` (เพิ่ม `PayInvoicesBulk`)
- Modify: `backend-go/adapters/sqldb/repository.go` (เพิ่ม `CreatePaymentBatch`, `FindUnpaidInvoices`)
- Modify: `backend-go/adapters/web/rest/handler.go` (เพิ่ม `PayInvoicesBulk`, `GetOutstandingBalance`)
- Modify: `backend-go/adapters/web/rest/server.go` (register routes)
- Test: `backend-go/adapters/web/rest/server_test.go`

**Interfaces:**
- Produces:
  - `GET /api/v1/users/:id/outstanding` → `{invoices: Invoice[], total: float64}` (rolesFinanceOrAdmin)
  - `POST /api/v1/tabwater/payments/bulk` body `{user_id, invoice_ids[], amount, batch_id(UUID)}` → 200 | 409 (duplicate batch_id) (rolesFinanceOrAdmin)

- [ ] **Step 1: เขียน failing tests**

```go
func TestGetOutstandingBalance_ReturnsUnpaidInvoices(t *testing.T) {
    // setup: 3 invoices for user, 2 unpaid
    // GET /users/:id/outstanding → {invoices: 2 items, total: sum}
}
func TestPayInvoicesBulk_AtomicSuccess(t *testing.T) {
    // POST bulk with 2 invoice_ids → 200, payment_records created for both
}
func TestPayInvoicesBulk_DuplicateBatchID(t *testing.T) {
    // POST twice with same batch_id → 409 Conflict
}
func TestPayInvoicesBulk_PartialFailRollback(t *testing.T) {
    // second invoice invalid → both rolled back, no payment_record created
}
```

- [ ] **Step 2: Run tests — verify FAIL**

- [ ] **Step 3: Implement `FindUnpaidInvoices(ctx, userID, orgID)` ใน `repository.go`**

Query: `SELECT * FROM invoices WHERE user_id=$1 AND org_id=$2 AND status='unpaid' ORDER BY period_id`

- [ ] **Step 4: Implement `CreatePaymentBatch(ctx, tx, batch)` ใน `repository.go`** ใช้ `pgx.Tx` parameter

- [ ] **Step 5: Implement `PayInvoicesBulk(ctx, req)` ใน `service.go`**

```go
// pseudo
tx := db.Begin()
batch := CreatePaymentBatch(ctx, tx, {...})
for _, invoiceID := range req.InvoiceIDs {
    PayInvoice(ctx, tx, invoiceID, batch.ID)
}
tx.Commit()
```

- [ ] **Step 6: Implement handlers + register routes**

```go
api.GET("/users/:id/outstanding", restHandler.GetOutstandingBalance, RequireRoles(rolesFinanceOrAdmin))
api.POST("/tabwater/payments/bulk", restHandler.PayInvoicesBulk, RequireRoles(rolesFinanceOrAdmin))
```

- [ ] **Step 7: Run tests — verify PASS** `go test ./... -run TestPayInvoices -v`

- [ ] **Step 8: Commit**

```bash
git commit -m "feat(api): bulk payment with atomic transaction and idempotency guard"
```

---

## Task 3: Backend — Debt Notice CRUD + ตัดมิเตอร์ / เปิดคืน

**Files:**
- Modify: `backend-go/application/service.go` (เพิ่ม `CreateDebtNotice`, `CutMeter`, `RestoreMeter`)
- Modify: `backend-go/adapters/sqldb/repository.go` (เพิ่ม CRUD สำหรับ `debt_notices`)
- Modify: `backend-go/adapters/web/rest/handler.go` + `server.go`
- Test: `backend-go/adapters/web/rest/server_test.go`

**Interfaces:**
- Produces:
  - `POST /api/v1/debt-notices` body `{user_id, invoice_ids[]}` → 201 (rolesAdminOnly)
  - `GET /api/v1/debt-notices` query `?status=&user_id=` → `[]DebtNotice` (rolesStaffOrAdmin)
  - `PATCH /api/v1/debt-notices/:id/cut` body `{meter_reading}` → 200 (rolesStaffOrAdmin, meter status → 'disconnected')
  - `PATCH /api/v1/debt-notices/:id/restore` → 200 (rolesStaffOrAdmin, ตรวจว่าชำระครบก่อน, meter status → 'active')
  - `GET /api/v1/users/:user_id/debt-notices` → `[]DebtNotice` (resident เห็นเฉพาะตัวเอง)

- [ ] **Step 1: เขียน failing tests**

```go
func TestCreateDebtNotice_AdminOnly(t *testing.T) {
    // staff role → 403; admin → 201
}
func TestCutMeter_RequiresDebtNoticeID(t *testing.T) {
    // PATCH /debt-notices/nonexistent/cut → 404
}
func TestRestoreMeter_BlockedWhenOutstanding(t *testing.T) {
    // restore แต่ยังค้างชำระ → 400 "outstanding balance remaining"
}
func TestGetUserDebtNotices_ResidentSeesOwnOnly(t *testing.T) {
    // resident token → เห็นเฉพาะ debt_notices.user_id == self
}
```

- [ ] **Step 2: Run tests — verify FAIL**

- [ ] **Step 3: Implement CRUD ใน `repository.go`** (`InsertDebtNotice`, `FindDebtNotices`, `UpdateDebtNoticeStatus`, `UpdateMeterStatus`)

- [ ] **Step 4: Implement `CutMeter` ใน `service.go`** — ตรวจ debt_notice status = 'sent', update meter status = 'disconnected', บันทึก `cut_meter_reading`, `cut_by`, `cut_at`

- [ ] **Step 5: Implement `RestoreMeter` ใน `service.go`** — ตรวจว่า `FindUnpaidInvoices` คืน 0 invoice ก่อน restore

- [ ] **Step 6: Register routes และ handlers**

```go
api.POST("/debt-notices", restHandler.CreateDebtNotice, RequireRoles(rolesAdminOnly))
api.GET("/debt-notices", restHandler.ListDebtNotices, RequireRoles(rolesStaffOrAdmin))
api.PATCH("/debt-notices/:id/cut", restHandler.CutMeter, RequireRoles(rolesStaffOrAdmin))
api.PATCH("/debt-notices/:id/restore", restHandler.RestoreMeter, RequireRoles(rolesStaffOrAdmin))
api.GET("/users/:user_id/debt-notices", restHandler.GetUserDebtNotices, RequireRoles(rolesStaffOrAdmin, "user"))
```

- [ ] **Step 7: Run tests — verify PASS**

- [ ] **Step 8: Commit**

```bash
git commit -m "feat(api): debt notice CRUD, meter cut/restore with balance guard"
```

---

## Task 4: Frontend — `debt-management` Feature (Admin + Staff)

**Files:**
- Create: `frontend-react/src/features/debt-management/index.ts`
- Create: `frontend-react/src/features/debt-management/debtManagementApi.ts`
- Create: `frontend-react/src/features/debt-management/useDebtManagement.ts`
- Create: `frontend-react/src/features/debt-management/DebtNoticeListScreen.tsx` (Admin)
- Create: `frontend-react/src/features/debt-management/CreateDebtNoticeModal.tsx` (Admin)
- Create: `frontend-react/src/features/debt-management/MeterCutScreen.tsx` (Staff)
- Create: `frontend-react/src/features/debt-management/debtManagement.test.ts`

**Interfaces:**
- Consumes: Debt Notice API endpoints จาก Task 3
- Produces:
  - Admin: หน้า list debt notices + modal สร้างใหม่ (เลือก user → แสดง outstanding invoices → confirm)
  - Staff: หน้าบันทึกการตัด (กรอกเลขมิเตอร์ล่าสุด + ยืนยัน) + ปุ่ม Restore

- [ ] **Step 1: เขียน failing tests**

```ts
// debtManagement.test.ts
it('fetches outstanding balance before creating debt notice', async () => { ... })
it('shows cut meter form with meter_reading input', async () => { ... })
it('restore button disabled when outstanding > 0', async () => { ... })
```

- [ ] **Step 2: Run tests — FAIL**

- [ ] **Step 3: Implement `debtManagementApi.ts`** — functions: `fetchDebtNotices()`, `createDebtNotice()`, `cutMeter()`, `restoreMeter()`

- [ ] **Step 4: Implement `useDebtManagement.ts`** hook — state: `notices`, `loading`, actions: `createNotice`, `cut`, `restore`

- [ ] **Step 5: Implement `DebtNoticeListScreen.tsx`** — table แสดง user, จำนวนรอบค้าง, ยอดรวม, status badge, ปุ่ม สร้างใบแจ้งเตือน, ปุ่ม ตัดมิเตอร์ (staff)

- [ ] **Step 6: Implement `CreateDebtNoticeModal.tsx`** — step 1: ค้นหา user, step 2: แสดง outstanding invoices, step 3: confirm สร้าง

- [ ] **Step 7: Implement `MeterCutScreen.tsx`** — form กรอก `meter_reading` + ปุ่ม ยืนยันตัดมิเตอร์ + ปุ่ม บันทึกเปิดคืน (disabled ถ้ายังค้าง)

- [ ] **Step 8: Run tests — PASS** + เพิ่ม route ใน App Router

- [ ] **Step 9: Commit**

```bash
git commit -m "feat(debt-management): admin debt notices and staff meter cut/restore UI"
```

---

## Task 5: Frontend — Resident Dashboard แสดง Debt Notice

**Files:**
- Modify: `frontend-react/src/features/liff-portal/LiffPortalScreen.tsx` (เพิ่ม Debt Notice banner)
- Modify: `frontend-react/src/features/liff-portal/liffPortalApi.ts` (เพิ่ม `fetchMyDebtNotices`)
- Modify: `frontend-react/src/features/liff-portal/useLiffPortal.ts`
- Test: `frontend-react/src/features/liff-portal/` (เพิ่ม test)

**Interfaces:**
- Consumes: `GET /api/v1/users/:user_id/debt-notices` → `DebtNotice[]` (filtered to self)
- Produces: Banner/Card แสดงใน Dashboard เมื่อมี debt notice สถานะ `pending` หรือ `sent` — แสดงยอดค้าง, จำนวนรอบ, และข้อความแจ้งเตือน

- [ ] **Step 1: เพิ่ม `fetchMyDebtNotices()` ใน `liffPortalApi.ts`**

- [ ] **Step 2: เขียน test**

```tsx
it('shows debt notice banner when pending debt exists', async () => {
  // mock API returns 1 pending debt notice
  render(<LiffPortalScreen />)
  await waitFor(() => expect(screen.getByText(/ค้างชำระ/)).toBeInTheDocument())
})
it('no banner when no debt notices', async () => { ... })
```

- [ ] **Step 3: Implement Debt Notice Banner component** inline ใน `LiffPortalScreen.tsx` — แสดง alert card สีแดงพร้อมยอดค้าง, ข้อความ "กรุณาชำระค่าน้ำที่ค้างชำระจำนวน X รอบ ยอดรวม X บาท"

- [ ] **Step 4: Run tests — PASS**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(liff): show debt notice banner on resident dashboard"
```

---

## Task 6: Frontend — `reports` Feature + Excel Export

**Files:**
- Create: `frontend-react/src/features/reports/index.ts`
- Create: `frontend-react/src/features/reports/reportsApi.ts`
- Create: `frontend-react/src/features/reports/useReports.ts`
- Create: `frontend-react/src/features/reports/DailyCollectionReport.tsx`
- Create: `frontend-react/src/features/reports/useExcelExport.ts`
- Create: `frontend-react/src/features/reports/reports.test.ts`

**Interfaces:**
- Consumes: `GET /api/v1/tabwater/reports/collections?from=YYYY-MM-DD&to=YYYY-MM-DD` (existing endpoint ที่มีอยู่แล้วใน `server.go` line 124)
- Produces:
  - หน้า รายงานการรับชำระ — DateRangePicker, ตารางผลลัพธ์, ปุ่ม Export Excel
  - Hook `useExcelExport(data, filename)` — ใช้ SheetJS สร้างไฟล์ `.xlsx` และ trigger download

- [ ] **Step 1: ติดตั้ง SheetJS** `npm install xlsx` ใน `frontend-react/`

- [ ] **Step 2: เขียน failing tests**

```ts
it('fetches collection report with date range', async () => { ... })
it('export button triggers xlsx download', async () => {
  // mock SheetJS writeFile
  // click Export Excel
  // expect writeFile called with correct sheet data
})
```

- [ ] **Step 3: Implement `useExcelExport.ts`**

Signature: `useExcelExport(): { exportToXlsx(rows: CollectionRow[], filename: string): void }`
ใช้ `XLSX.utils.json_to_sheet(rows)` + `XLSX.writeFile(wb, filename)`

- [ ] **Step 4: Implement `DailyCollectionReport.tsx`** — DateRangePicker (from/to), ตาราง columns: วันที่, บ้านเลขที่, ชื่อ, จำนวนหน่วย, ยอดชำระ, ผู้รับเงิน + ยอดรวมท้ายตาราง + ปุ่ม Export Excel

- [ ] **Step 5: Run tests — PASS**

- [ ] **Step 6: เพิ่ม route ใน App Router** (เฉพาะ `finance_staff` และ `admin`)

- [ ] **Step 7: Commit**

```bash
git commit -m "feat(reports): daily collection report with Excel export (SheetJS)"
```

---

## Final Verification

- [ ] `cd backend-go && go test -v ./...` — all PASS
- [ ] `cd frontend-react && npm test && npm run build` — all PASS
- [ ] Manual: Admin สร้าง Debt Notice → Resident เห็น banner บน Dashboard
- [ ] Manual: Staff กรอกเลขมิเตอร์ตัด → meter status = disconnected ใน DB
- [ ] Manual: Finance export Excel → ไฟล์ .xlsx ดาวน์โหลดถูกต้อง
- [ ] Manual: Bulk payment 2 รอบค้าง → payment_records 2 รายการ ใน transaction เดียว
