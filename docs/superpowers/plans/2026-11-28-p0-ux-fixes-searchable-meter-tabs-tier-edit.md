# P0 UX Fixes Implementation Plan
# (Searchable Meter + Route, Status Tabs, VAT/Tier Edit)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** แก้ UX 3 จุดที่ Staff/Admin พบปัญหาในการใช้งานประจำวัน: (1) เปลี่ยน Dropdown มิเตอร์เป็น Searchable Combobox กรองตาม Staff Route, (2) แยกรายการมิเตอร์เป็น 2 แท็บ "บันทึกแล้ว" / "ยังไม่บันทึก", (3) ให้ Admin แก้ไข VAT และ Tier ได้จาก UI

**Architecture:** Vertical Slice — แก้ `field-reader` feature และ `master-data` feature เป็นอิสระต่อกัน Backend เพิ่ม 2 endpoints ใหม่ใน `server.go` และ DB migration 1 ไฟล์สำหรับ `tw_meter_routes` table

**Tech Stack:** Go 1.24+, Echo v4, PostgreSQL, React 18, TypeScript, Vite, Tailwind CSS, `cmdk` (Combobox)

**Spec:** `docs/superpowers/specs/2026-11-28-new-features-design.md`

## Global Constraints

- `org_id` ต้องอยู่ใน WHERE clause ทุก query — ห้ามใช้ user_id อย่างเดียว
- Route `/tabwater/meter-routes` ใช้ `RequireRoles(rolesStaffOrAdmin)` เท่านั้น
- Route แก้ VAT/Tier ต้องใช้ `RequireRoles(rolesAdminOnly)` เท่านั้น
- ทุก migration file ใช้ pattern `000004_<name>.up.sql` / `000004_<name>.down.sql`
- Frontend ทุก API call ผ่าน `fieldReaderApi.ts` หรือ `masterDataApi.ts` เท่านั้น (ไม่ fetch ตรงใน component)
- Combobox ใช้ library `cmdk` (ติดตั้งผ่าน `npm install cmdk`)
- ทุก test file อยู่ใน feature folder เดียวกันกับ implementation

## Review Focus

- Staff ที่ไม่มี route assigned → Combobox ต้องแสดง meter ทั้งหมด (ไม่ filter)
- Tier ที่มี gap หรือ overlap ระหว่าง from/to → API ต้อง return 400 พร้อม error message
- Admin แก้ Tier ของ invoice period ที่ finalize แล้ว → ต้องห้ามแก้ (return 409)
- แท็บ "บันทึกแล้ว" ของ period อื่น (ไม่ใช่ current) → ต้อง filter ด้วย current period_id
- Race condition: Staff 2 คน save reading เดียวกัน → `client_reading_id` unique constraint บน DB

---

## Task 1: DB Migration — เพิ่ม `tw_meter_routes` Table

**Files:**
- Create: `backend-go/db/migrations/000004_add_meter_routes.up.sql`
- Create: `backend-go/db/migrations/000004_add_meter_routes.down.sql`

**Interfaces:**
- Produces: table `tw_meter_routes(id BIGSERIAL PK, org_id BIGINT FK, name VARCHAR(100), staff_id BIGINT FK nullable, created_at TIMESTAMPTZ)` และ column `route_id BIGINT FK nullable` บน `tw_meter_infos`

- [ ] **Step 1: เขียน up migration**

```sql
-- 000004_add_meter_routes.up.sql
CREATE TABLE tw_meter_routes (
  id         BIGSERIAL PRIMARY KEY,
  org_id     BIGINT NOT NULL REFERENCES organizations(id),
  name       VARCHAR(100) NOT NULL,
  staff_id   BIGINT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE tw_meter_infos ADD COLUMN route_id BIGINT REFERENCES tw_meter_routes(id);

-- RLS: staff เห็นเฉพาะ route ของ org ตัวเอง
ALTER TABLE tw_meter_routes ENABLE ROW LEVEL SECURITY;
CREATE POLICY tw_meter_routes_org_isolation ON tw_meter_routes
  USING (org_id = current_setting('app.current_org_id')::BIGINT);
```

- [ ] **Step 2: เขียน down migration**

```sql
-- 000004_add_meter_routes.down.sql
ALTER TABLE tw_meter_infos DROP COLUMN IF EXISTS route_id;
DROP TABLE IF EXISTS tw_meter_routes;
```

- [ ] **Step 3: Run migration ใน test DB**

```bash
cd backend-go && go test ./db/... -v -run TestMigrations
```
Expected: PASS, tables created

- [ ] **Step 4: Commit**

```bash
git add backend-go/db/migrations/000004_*
git commit -m "feat(db): add tw_meter_routes table and route_id to tw_meter_infos"
```

---

## Task 2: Backend — API `GET /tabwater/meter-routes`

**Files:**
- Modify: `backend-go/adapters/web/rest/server.go` (เพิ่ม route)
- Modify: `backend-go/adapters/web/rest/handler.go` (เพิ่ม `GetMeterRoutes`)
- Modify: `backend-go/application/service.go` (เพิ่ม `ListMeterRoutes`)
- Modify: `backend-go/adapters/sqldb/repository.go` (เพิ่ม `FindMeterRoutes`)
- Test: `backend-go/adapters/web/rest/server_test.go`

**Interfaces:**
- Consumes: `tw_meter_routes` table จาก Task 1
- Produces: `GET /api/v1/tabwater/meter-routes?org_id=<id>` → `[{id, name, staff_id}]`

- [ ] **Step 1: เขียน failing test**

```go
// server_test.go
func TestGetMeterRoutes_StaffGetsOwnOrgRoutes(t *testing.T) {
    // setup: สร้าง 2 routes ใน org1, 1 route ใน org2
    // request GET /api/v1/tabwater/meter-routes ด้วย staff token org1
    // assert: response มี 2 routes, ไม่มี org2 route
}
func TestGetMeterRoutes_UnauthorizedRole(t *testing.T) {
    // request ด้วย user role (LIFF) → expect 403
}
```

- [ ] **Step 2: Run test — verify FAIL** `go test ./adapters/web/rest/... -run TestGetMeterRoutes -v`

- [ ] **Step 3: Implement `FindMeterRoutes(ctx, orgID) ([]MeterRoute, error)` ใน `repository.go`**

Query: `SELECT id, name, staff_id FROM tw_meter_routes WHERE org_id = $1 ORDER BY name`

- [ ] **Step 4: Implement `ListMeterRoutes(ctx, orgID)` ใน `service.go`** โดย delegate ไป repository

- [ ] **Step 5: Implement `GetMeterRoutes` handler ใน `handler.go`** — parse `org_id` จาก Claims, เรียก service, return JSON 200

- [ ] **Step 6: Register route ใน `server.go`**

```go
api.GET("/tabwater/meter-routes", restHandler.GetMeterRoutes, RequireRoles(rolesStaffOrAdmin))
```

- [ ] **Step 7: Run test — verify PASS** `go test ./adapters/web/rest/... -run TestGetMeterRoutes -v`

- [ ] **Step 8: Commit**

```bash
git add backend-go/adapters/ backend-go/application/
git commit -m "feat(api): GET /tabwater/meter-routes with org-scoped RBAC"
```

---

## Task 3: Frontend — Searchable Meter Combobox ใน `field-reader`

**Files:**
- Modify: `frontend-react/src/features/field-reader/fieldReaderApi.ts` (เพิ่ม `fetchMeterRoutes`)
- Modify: `frontend-react/src/features/field-reader/useFieldReader.ts` (เพิ่ม route state + filter logic)
- Create: `frontend-react/src/features/field-reader/MeterSearchCombobox.tsx`
- Modify: `frontend-react/src/features/field-reader/FieldReaderScreen.tsx` (แทน `<select>` ด้วย Combobox)
- Create: `frontend-react/src/features/field-reader/MeterSearchCombobox.test.tsx`

**Interfaces:**
- Consumes: `fetchMeterRoutes()` → `Route[]`, `fetchMeters(routeId?)` → `Meter[]`
- Produces: `<MeterSearchCombobox onSelect(meterId) />` — ค้นหาแบบ type-ahead, แสดง `บ้านเลขที่ | ชื่อ | เลขมิเตอร์`

- [ ] **Step 1: ติดตั้ง `cmdk`** `npm install cmdk` ใน `frontend-react/`

- [ ] **Step 2: เพิ่ม `fetchMeterRoutes()` ใน `fieldReaderApi.ts`**

Signature: `fetchMeterRoutes(): Promise<MeterRoute[]>` → GET `/api/v1/tabwater/meter-routes`

- [ ] **Step 3: เพิ่ม route filter logic ใน `useFieldReader.ts`**

State เพิ่ม: `selectedRouteId: number | null`, `filteredMeters: Meter[]`
Effect: เมื่อ `selectedRouteId` เปลี่ยน → `fetchMeters({ routeId })` (ถ้า null → fetch all)

- [ ] **Step 4: เขียน failing test สำหรับ `MeterSearchCombobox`**

```tsx
// MeterSearchCombobox.test.tsx
it('filters meters by search text', async () => {
  render(<MeterSearchCombobox meters={mockMeters} onSelect={jest.fn()} />)
  await userEvent.type(screen.getByRole('combobox'), 'สมชาย')
  expect(screen.getByText(/สมชาย/)).toBeInTheDocument()
  expect(screen.queryByText(/สมหญิง/)).not.toBeInTheDocument()
})
it('calls onSelect with meterId when item clicked', async () => { ... })
```

- [ ] **Step 5: Run test — verify FAIL** `npm test -- MeterSearchCombobox`

- [ ] **Step 6: Implement `MeterSearchCombobox.tsx`** ใช้ `cmdk` Command component, แสดง `{meter.house_number} | {meter.owner_name} | {meter.meter_serial}`

- [ ] **Step 7: Run test — verify PASS** `npm test -- MeterSearchCombobox`

- [ ] **Step 8: แทน `<select>` ใน `FieldReaderScreen.tsx`** ด้วย `<MeterSearchCombobox>` + `<RouteFilter>` dropdown ด้านบน

- [ ] **Step 9: Commit**

```bash
git add frontend-react/src/features/field-reader/
git commit -m "feat(field-reader): searchable meter combobox with route filter"
```

---

## Task 4: Frontend — แท็บ "บันทึกแล้ว" / "ยังไม่บันทึก" ใน `field-reader`

**Files:**
- Modify: `frontend-react/src/features/field-reader/useFieldReader.ts` (เพิ่ม tab state + edit mode)
- Modify: `frontend-react/src/features/field-reader/FieldReaderScreen.tsx` (เพิ่ม Tabs UI + Edit button)
- Modify: `backend-go/adapters/web/rest/server.go` (เพิ่ม `GET /tabwater/readings?period_id=&status=`)
- Modify: `backend-go/adapters/web/rest/handler.go` (เพิ่ม `ListReadings`)
- Test: `frontend-react/src/features/field-reader/fieldReaderCamera.test.tsx` (เพิ่ม tab tests)

**Interfaces:**
- Consumes: `GET /api/v1/tabwater/readings?period_id=<current>&status=recorded|pending` → `Reading[]`
- Produces: สองแท็บ — `🟢 บันทึกแล้ว (N)` | `🔴 ยังไม่บันทึก (M)`, แท็บ บันทึกแล้ว มีปุ่ม แก้ไข (เฉพาะ period ปัจจุบัน ที่ยังไม่ finalize)

- [ ] **Step 1: Backend — เพิ่ม `GET /tabwater/readings` handler**

Filter parameters: `period_id`, `status` (recorded | pending), `route_id` (optional)
Query: join `tw_meter_readings` กับ `tw_meter_infos` กรองด้วย `org_id` + `period_id`
Register: `api.GET("/tabwater/readings", restHandler.ListReadings, RequireRoles(rolesStaffOrAdmin))`

- [ ] **Step 2: Backend test**

```go
func TestListReadings_FilterByStatus(t *testing.T) {
    // expect recorded readings only when status=recorded
    // expect 403 for unauthorized role
}
```
Run: `go test ./adapters/web/rest/... -run TestListReadings -v` → PASS

- [ ] **Step 3: Frontend test**

```tsx
it('shows recorded tab with count badge', async () => {
  render(<FieldReaderScreen />)
  await waitFor(() => expect(screen.getByText(/บันทึกแล้ว \(\d+\)/)).toBeInTheDocument())
})
it('shows edit button only on recorded tab items in current period', () => { ... })
```

- [ ] **Step 4: Implement Tab UI ใน `FieldReaderScreen.tsx`** — 2 แท็บด้วย Tailwind, แสดง count badge, แท็บ "บันทึกแล้ว" มีปุ่ม แก้ไข ที่ load form พร้อม existing data

- [ ] **Step 5: Run frontend tests** `npm test -- FieldReaderScreen` → PASS

- [ ] **Step 6: Commit**

```bash
git add backend-go/ frontend-react/src/features/field-reader/
git commit -m "feat(field-reader): add recorded/pending tabs and edit mode for current period"
```

---

## Task 5: Backend + Frontend — Admin แก้ไข VAT / Tier

**Files:**
- Modify: `backend-go/adapters/web/rest/server.go` (เพิ่ม `PUT /tabwater/rate-configs/:id`)
- Modify: `backend-go/adapters/web/rest/handler.go` (เพิ่ม `UpdateRateConfig`)
- Modify: `backend-go/application/service.go` (เพิ่ม `UpdateRateConfig` พร้อม tier validation)
- Modify: `frontend-react/src/features/master-data/` (เพิ่ม TierEditor UI)
- Test: `backend-go/adapters/web/rest/server_test.go`, `frontend-react/src/features/tariffs-meters/`

**Interfaces:**
- Consumes: existing `tw_meter_type_rate_configs`, `tw_meter_type_rate_tiers` tables
- Produces:
  - `PUT /api/v1/tabwater/rate-configs/:id` body `{vat, reserve_fee, tiers: [{from, to, rate}]}` → 200 | 400 (gap/overlap) | 403 | 409 (finalized)
  - Frontend: TierEditor component ที่ add/remove tier rows ด้วย dynamic form

- [ ] **Step 1: Backend test**

```go
func TestUpdateRateConfig_ValidTiers(t *testing.T) {
    // PUT tiers [{from:0,to:10,rate:50},{from:11,to:50,rate:80}] → 200
}
func TestUpdateRateConfig_GapInTiers(t *testing.T) {
    // PUT tiers [{from:0,to:5},{from:10,to:50}] → 400 "tier gap detected"
}
func TestUpdateRateConfig_NonAdminForbidden(t *testing.T) {
    // staff role → 403
}
```

- [ ] **Step 2: Run tests — verify FAIL**

- [ ] **Step 3: Implement tier gap/overlap validation ใน `service.go`**

Sort tiers by `from`, check: `tiers[i].to + 1 == tiers[i+1].from` ทุก pair

- [ ] **Step 4: Implement `UpdateRateConfig` handler** และ register `api.PUT("/tabwater/rate-configs/:id", ..., RequireRoles(rolesAdminOnly))`

- [ ] **Step 5: Run backend tests — verify PASS**

- [ ] **Step 6: Frontend test**

```tsx
it('renders existing tiers in editable rows', async () => { ... })
it('shows error when tier gap detected on save', async () => { ... })
it('add new tier row on "เพิ่ม Tier" button click', async () => { ... })
```

- [ ] **Step 7: Implement `TierEditor.tsx`** — table ที่แต่ละ row มี input `from`, `to`, `rate` + ปุ่ม ลบ row + ปุ่ม เพิ่ม Tier + ปุ่ม บันทึก

- [ ] **Step 8: Run frontend tests — PASS**

- [ ] **Step 9: Commit**

```bash
git add backend-go/ frontend-react/src/features/
git commit -m "feat(admin): editable VAT and dynamic tier management with gap validation"
```

---

## Final Verification

- [ ] `cd backend-go && go test -v ./...` — all PASS
- [ ] `cd frontend-react && npm test && npm run build` — all PASS, no build errors
- [ ] Manual smoke test: Staff login → เลือก Route → Combobox ค้นหาได้ → แท็บแยกสถานะ
- [ ] Manual smoke test: Admin login → แก้ VAT 7% → เพิ่ม Tier → บันทึก → เห็นในหน้า rate config
