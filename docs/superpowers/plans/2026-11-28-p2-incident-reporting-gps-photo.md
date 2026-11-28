# P2 Incident Reporting Implementation Plan
# (แจ้งเหตุ GPS + ถ่ายภาพ + Text จาก Resident, รับงาน/ปิดงาน โดย Staff)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** สร้างระบบแจ้งเหตุสองทาง — Resident แจ้งเหตุ (น้ำไม่ไหล/น้ำขุ่น/ท่อแตก) พร้อมพิกัด GPS จาก Browser API, ถ่ายภาพ 1 รูป, และข้อความ textarea; Staff เห็น Incident list, รับงาน, และปิดงานพร้อม resolution note

**Architecture:** Backend เพิ่ม `incidents` table (migration 000007) + 5 API endpoints Frontend เพิ่ม feature `incidents` ใหม่ ใช้ `navigator.geolocation` API สำหรับ GPS และ `input[type=file]` สำหรับถ่ายภาพ ไม่ใช้ Google Maps ใน phase นี้

**Tech Stack:** Go 1.24+, Echo v4, PostgreSQL, React 18, TypeScript, Browser Geolocation API, Multipart file upload (เดิมมีใน OCR handler แล้ว)

**Spec:** `docs/superpowers/specs/2026-11-28-new-features-design.md` (ตอบ Q2=ไม่มี Google Maps, เก็บแค่ lat/lng + ถ่ายภาพ 1 รูป + textarea)

## Global Constraints

- `lat`, `lng` ห้าม log ใน application logs หรือ error response body ทุกกรณี (evidence-hygiene)
- Resident เห็นเฉพาะ `incidents.reporter_user_id = current_user_id` เสมอเมื่อ role = `user`
- Staff เห็น incidents ทั้งหมดใน `org_id` เดียวกัน
- รูปภาพ incident เก็บใน storage เดียวกับ meter photo (path: `/uploads/incidents/<id>.<ext>`)
- รูปภาพ ต้อง validate MIME type (jpeg/png/webp เท่านั้น) และขนาดไม่เกิน 10MB
- Migration ต่อเนื่องจาก 000006 → ใช้ `000007`

## Review Focus

- Resident แจ้งเหตุโดยไม่ให้สิทธิ์ GPS → ต้อง allow (lat/lng = null) ไม่ block การส่ง
- Staff `assign` incident ที่ถูก assign ไปแล้ว → 409 Conflict หรือ override? (Decision: allow override แต่ log previous assignee)
- รูปภาพขนาดใหญ่ / MIME ผิด → 400 พร้อม error message ชัดเจน
- Resident ส่ง incident_id ของ Resident คนอื่นเพื่อดูรายละเอียด → 404 (ไม่ใช่ 403 เพื่อป้องกัน enumeration)
- Status transition ผิดลำดับ (เช่น resolved → in_progress) → ต้อง validate และ return 400

---

## Task 1: DB Migration — `incidents` Table

**Files:**
- Create: `backend-go/db/migrations/000007_add_incidents.up.sql`
- Create: `backend-go/db/migrations/000007_add_incidents.down.sql`

**Interfaces:**
- Produces: table `incidents(id UUID PK, org_id BIGINT FK, reporter_user_id BIGINT FK, incident_type VARCHAR(50), description TEXT, lat NUMERIC(10,7) nullable, lng NUMERIC(10,7) nullable, photo_url TEXT nullable, status VARCHAR(20) DEFAULT 'open', assigned_to BIGINT FK nullable, assigned_at TIMESTAMPTZ, resolved_at TIMESTAMPTZ, resolution_note TEXT, created_at TIMESTAMPTZ)`

- [ ] **Step 1: เขียน up migration**

```sql
CREATE TABLE incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id BIGINT NOT NULL REFERENCES organizations(id),
  reporter_user_id BIGINT NOT NULL REFERENCES users(id),
  incident_type VARCHAR(50) NOT NULL,
  description TEXT,
  lat NUMERIC(10,7),
  lng NUMERIC(10,7),
  photo_url TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'open',
  assigned_to BIGINT REFERENCES users(id),
  assigned_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  resolution_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX incidents_org_id_status_idx ON incidents(org_id, status);
ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;
CREATE POLICY incidents_org_isolation ON incidents USING (org_id = current_setting('app.current_org_id')::BIGINT);
```

- [ ] **Step 2: เขียน down migration**

```sql
DROP TABLE IF EXISTS incidents;
```

- [ ] **Step 3: Run test** `go test ./db/... -v` → PASS

- [ ] **Step 4: Commit**

```bash
git add backend-go/db/migrations/000007_*
git commit -m "feat(db): add incidents table with GPS, photo, and status tracking"
```

---

## Task 2: Backend — Incident CRUD API

**Files:**
- Modify: `backend-go/application/service.go` (เพิ่ม `CreateIncident`, `ListIncidents`, `AssignIncident`, `ResolveIncident`)
- Modify: `backend-go/adapters/sqldb/repository.go` (เพิ่ม Incident CRUD)
- Modify: `backend-go/adapters/web/rest/handler.go` (เพิ่ม Incident handlers + multipart photo upload)
- Modify: `backend-go/adapters/web/rest/server.go` (register routes)
- Test: `backend-go/adapters/web/rest/server_test.go`

**Interfaces:**
- Produces:
  - `POST /api/v1/incidents` multipart: `{incident_type, description, lat?, lng?, photo?}` → 201 (role: user/staff/admin)
  - `GET /api/v1/incidents` query `?status=&assigned_to=` → `[]Incident` (staff/admin — org scoped)
  - `GET /api/v1/incidents/my` → `[]Incident` (user — reporter_user_id = self only)
  - `PATCH /api/v1/incidents/:id/assign` body `{staff_id}` → 200 (staff/admin)
  - `PATCH /api/v1/incidents/:id/resolve` body `{resolution_note}` → 200 (staff/admin)

- [ ] **Step 1: เขียน failing tests**

```go
func TestCreateIncident_ResidentWithGPS(t *testing.T) {
    // POST multipart: type=no_water, lat=13.7, lng=100.5 → 201
    // ตรวจ: lat/lng ไม่ปรากฏใน log output (evidence-hygiene)
}
func TestCreateIncident_WithoutGPS(t *testing.T) {
    // POST multipart: type=broken_pipe, lat=nil → 201 (GPS optional)
}
func TestCreateIncident_InvalidMIME(t *testing.T) {
    // POST with photo.pdf → 400 "invalid file type"
}
func TestGetMyIncidents_ResidentSeesOnlyOwn(t *testing.T) {
    // resident token → GET /incidents/my → only reporter_user_id == self
}
func TestGetIncidents_StaffSeesAllInOrg(t *testing.T) {
    // staff → GET /incidents → all org incidents
}
func TestAssignIncident_StaffOnly(t *testing.T) {
    // user role → PATCH /incidents/:id/assign → 403
}
func TestResolveIncident_InvalidTransition(t *testing.T) {
    // resolve an already resolved incident → 400
}
```

- [ ] **Step 2: Run tests — verify FAIL**

- [ ] **Step 3: Implement `InsertIncident`, `FindIncidents`, `FindMyIncidents`, `UpdateIncidentStatus` ใน `repository.go`**

ห้าม include lat/lng ใน SELECT สำหรับ list view — เปิดเฉพาะใน detail view (GET /incidents/:id)

- [ ] **Step 4: Implement `CreateIncident` ใน `service.go`**

- handle multipart: validate MIME (`image/jpeg`, `image/png`, `image/webp`), size ≤ 10MB
- บันทึกไฟล์ไปที่ `uploads/incidents/<uuid>.<ext>`
- ไม่ log lat/lng ค่าจริงในทุก log statement

- [ ] **Step 5: Implement `AssignIncident` ใน `service.go`** — validate status transition: open/in_progress → in_progress; บันทึก previous assignee ใน description

- [ ] **Step 6: Implement `ResolveIncident` ใน `service.go`** — validate: status ต้องเป็น `in_progress` → `resolved`; บันทึก `resolved_at`, `resolution_note`

- [ ] **Step 7: Implement handlers + register routes**

```go
allRoles := append(rolesStaffOrAdmin, "user") // resident + staff + admin
api.POST("/incidents", restHandler.CreateIncident, RequireRoles(allRoles))
api.GET("/incidents", restHandler.ListIncidents, RequireRoles(rolesStaffOrAdmin))
api.GET("/incidents/my", restHandler.GetMyIncidents, RequireRoles(allRoles))
api.PATCH("/incidents/:id/assign", restHandler.AssignIncident, RequireRoles(rolesStaffOrAdmin))
api.PATCH("/incidents/:id/resolve", restHandler.ResolveIncident, RequireRoles(rolesStaffOrAdmin))
```

- [ ] **Step 8: Run tests — verify PASS** `go test ./... -run TestIncident -v`

- [ ] **Step 9: Commit**

```bash
git commit -m "feat(api): incident CRUD with GPS, photo upload, assign/resolve workflow"
```

---

## Task 3: Frontend — Resident แจ้งเหตุ ใน `liff-portal`

**Files:**
- Modify: `frontend-react/src/features/liff-portal/liffPortalApi.ts` (เพิ่ม `submitIncident`)
- Modify: `frontend-react/src/features/liff-portal/useLiffPortal.ts` (เพิ่ม incident state)
- Create: `frontend-react/src/features/liff-portal/ReportIncidentForm.tsx`
- Test: เพิ่มใน existing liff test file

**Interfaces:**
- Produces: `<ReportIncidentForm />` — Step 1: เลือกประเภทเหตุ (4 ปุ่ม), Step 2: กด "ใช้ตำแหน่งปัจจุบัน" (optional) + textarea + input[type=file capture=environment], Step 3: submit

- [ ] **Step 1: เขียน failing tests**

```tsx
it('shows incident type selector as first step', async () => {
  render(<ReportIncidentForm />)
  expect(screen.getByText('น้ำไม่ไหล')).toBeInTheDocument()
  expect(screen.getByText('น้ำขุ่น')).toBeInTheDocument()
  expect(screen.getByText('ท่อแตก')).toBeInTheDocument()
  expect(screen.getByText('อื่น ๆ')).toBeInTheDocument()
})
it('calls geolocation API when user clicks GPS button', async () => {
  const mockGeo = jest.fn()
  global.navigator.geolocation = { getCurrentPosition: mockGeo }
  render(<ReportIncidentForm />)
  userEvent.click(screen.getByText(/ใช้ตำแหน่งปัจจุบัน/))
  expect(mockGeo).toHaveBeenCalled()
})
it('allows submit without GPS', async () => {
  // GPS button not clicked → submit ได้ปกติ (lat/lng = null)
})
it('validates file MIME before upload', async () => {
  // upload .pdf file → show error message
})
```

- [ ] **Step 2: Run tests — FAIL**

- [ ] **Step 3: Implement `ReportIncidentForm.tsx`**

Step 1: 4 ปุ่มประเภทเหตุ (icon + label)
Step 2:
  - ปุ่ม "📍 ใช้ตำแหน่งปัจจุบัน" → เรียก `navigator.geolocation.getCurrentPosition()` → แสดง ✅ ตำแหน่งถูกบันทึกแล้ว (อย่าแสดงค่า lat/lng ใน UI)
  - `<textarea placeholder="อธิบายเหตุการณ์...">` สูงสุด 500 ตัวอักษร
  - `<input type="file" accept="image/jpeg,image/png,image/webp" capture="environment">` พร้อม preview thumbnail
  - Validate client-side: file.type ต้องขึ้นต้น `image/`
Step 3: ปุ่ม ส่งแจ้งเหตุ → multipart POST

- [ ] **Step 4: เพิ่ม link ไปยัง `ReportIncidentForm` ใน `LiffPortalScreen.tsx`** — ปุ่ม/card "แจ้งเหตุ"

- [ ] **Step 5: Run tests — PASS**

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(liff): resident incident reporting form with GPS and photo"
```

---

## Task 4: Frontend — `incidents` Feature สำหรับ Staff Dashboard

**Files:**
- Create: `frontend-react/src/features/incidents/index.ts`
- Create: `frontend-react/src/features/incidents/incidentsApi.ts`
- Create: `frontend-react/src/features/incidents/useIncidents.ts`
- Create: `frontend-react/src/features/incidents/IncidentDashboard.tsx`
- Create: `frontend-react/src/features/incidents/IncidentDetailModal.tsx`
- Create: `frontend-react/src/features/incidents/incidents.test.ts`

**Interfaces:**
- Consumes: `GET /api/v1/incidents`, `PATCH /incidents/:id/assign`, `PATCH /incidents/:id/resolve`
- Produces:
  - `IncidentDashboard` — ตารางรายการ: วันที่, ประเภท, ชื่อผู้แจ้ง, สถานะ badge (open=แดง/in_progress=เหลือง/resolved=เขียว), ปุ่ม รับงาน / ดูรายละเอียด
  - `IncidentDetailModal` — แสดง description, photo (ถ้ามี), ปุ่ม เปิด Google Maps link จาก lat/lng, ปุ่ม ปิดงาน + textarea resolution note

- [ ] **Step 1: เขียน failing tests**

```ts
it('shows incident list with status badges', async () => { ... })
it('assign button changes status to in_progress', async () => { ... })
it('resolve requires resolution_note not empty', async () => { ... })
it('detail modal shows google maps link when lat/lng present', async () => {
  // lat=13.7, lng=100.5 → link href contains "maps.google.com"
})
```

- [ ] **Step 2: Run tests — FAIL**

- [ ] **Step 3: Implement `incidentsApi.ts`** — `fetchIncidents()`, `assignIncident(id, staffId)`, `resolveIncident(id, note)`

- [ ] **Step 4: Implement `useIncidents.ts`** hook

- [ ] **Step 5: Implement `IncidentDashboard.tsx`** — table + status badge + filter dropdown (All/Open/In Progress/Resolved)

- [ ] **Step 6: Implement `IncidentDetailModal.tsx`** — แสดงรายละเอียดครบถ้วน + Google Maps link (ถ้า lat/lng ไม่ null ให้สร้าง `https://maps.google.com/?q={lat},{lng}` เป็น link ธรรมดา) + photo preview + resolve form

- [ ] **Step 7: Run tests — PASS** + เพิ่ม route ใน App Router (เฉพาะ staff/admin)

- [ ] **Step 8: Commit**

```bash
git commit -m "feat(incidents): staff incident dashboard with assign, resolve, and GPS link"
```

---

## Final Verification

- [ ] `cd backend-go && go test -v ./...` — all PASS
- [ ] `cd frontend-react && npm test && npm run build` — all PASS
- [ ] Manual: Resident กด แจ้งเหตุ → เลือกน้ำขุ่น → กด GPS → ถ่ายภาพ → ส่ง → เห็น incident ใหม่
- [ ] Manual: Staff เห็น incident ใหม่ใน Dashboard → รับงาน → status เปลี่ยน → ปิดงาน
- [ ] Manual: Resident ไม่ได้ให้สิทธิ์ GPS → ส่งได้ปกติ (lat/lng = null ใน DB)
- [ ] Manual: อัปโหลดไฟล์ .pdf → เห็น error message ชัดเจน
- [ ] Security: Resident ลอง GET /incidents → 403; GET /incidents/my → เห็นแค่ของตัวเอง
