# Water Smart Bill — Implementation Plan (`writing-plans`)

> **For agentic workers:** Follow `superpowers:test-driven-development` (RED-GREEN-REFACTOR) and `superpowers:verification-before-completion` strictly.

**Goal:** พัฒนาระบบบริหารจัดการค่าน้ำประปาสำหรับ อบต. (`water-smart-bill`) ครบวงจรตามที่ได้ออกแบบและได้รับการ Approve

---

## Task Breakdown (Bite-Sized TDD Tasks)

### Task 1: Database Migrations & Schema Foundation (`backend-go/db/migrations/`)
- **Files:**
  - `backend-go/db/migrations/000001_water_smart_bill_schema.up.sql`
  - `backend-go/db/migrations/000001_water_smart_bill_schema.down.sql`
  - `backend-go/db/migrations/000002_enable_rls.up.sql`
  - `backend-go/db/migrations/000002_enable_rls.down.sql`
- **Details:** สร้างตาราง `provinces`, `districts`, `tambons`, `organizations`, `zones`, `subzones`, `users` (พร้อม `house_no` และ `image` avatar), `tw_pricing_types`, `tw_meter_types`, `tw_meter_type_rate_configs`, `tw_meter_type_rate_tiers`, `invoice_period`, `tw_meter_infos`, `tw_invoice` (พร้อม `client_reading_id`, `reading_photo_url`, `ocr_text`, `ocr_confidence`), `tw_acc_transactions` และ Seed ข้อมูลตัวอย่างสำหรับ Demo

### Task 2: Backend Domain & Progressive Water Bill + Default Avatar + OCR Rules (TDD)
- **Files:**
  - `backend-go/internal/domain/domain_test.go`
  - `backend-go/internal/domain/domain.go`
  - `backend-go/internal/domain/tabwater_test.go`
  - `backend-go/internal/domain/tabwater.go`
- **Verification:** `cd backend-go && go test ./internal/domain/... -v`
- **Details:**
  - เขียน Unit Tests ทดสอบ `CalculateProgressiveWaterBill`, `ResolveAvatarURL` (คืน Default Avatar `/api/v1/avatars/default?name=...` เมื่อไม่มีรูปอัปโหลด), `GenerateDefaultAvatarSVG`, การตรวจสอบ `RecordMeterReadingCommand` (รองรับ Offline `client_reading_id`), และการจำลอง/ประมวลผล OCR (`ParseMeterOCRReading`)

### Task 3: JWT Blacklist Store (Redis + In-Memory Fallback) & Keycloak Verifier (TDD)
- **Files:**
  - `backend-go/internal/adapter/out/blacklist/blacklist_test.go`
  - `backend-go/internal/adapter/out/blacklist/blacklist.go`
  - `backend-go/internal/adapter/out/keycloak/verifier_test.go`
  - `backend-go/internal/adapter/out/keycloak/verifier.go`
- **Verification:** `cd backend-go && go test ./internal/adapter/out/... -v`
- **Details:**
  - ทดสอบการเพิกถอน JWT (`RevokeToken(ctx, jti, expiresAt)`) และการตรวจสอบ (`IsRevoked(ctx, jti)`) ทั้งบน Redis และ In-Memory Store

### Task 4: Backend Application Services & HTTP Handlers + Non-Prod Swagger Gate (TDD)
- **Files:**
  - `backend-go/internal/app/water_service_test.go`
  - `backend-go/internal/app/water_service.go`
  - `backend-go/internal/adapter/in/http/server_test.go`
  - `backend-go/internal/adapter/in/http/server.go`
  - `backend-go/internal/adapter/out/postgres/store.go`
  - `backend-go/api/openapi.yaml`
  - `backend-go/cmd/api/main.go`
- **Verification:** `cd backend-go && go test ./... -v`
- **Details:**
  - ทดสอบ API ครบทุกเส้นทาง:
    - ข้อมูล อบต., ตำบล, หมู่บ้าน, เจ้าของบ้าน + Default Avatar + Upload Avatar
    - ตั้งค่าเรทค่าน้ำขั้นบันได + เปิดรอบบิล + ขึ้นทะเบียนมิเตอร์
    - บันทึกมิเตอร์ + คำนวณค่าน้ำ + OCR อ่านเลขมิเตอร์จากรูป
    - Offline Bundle & Batch Sync (`Idempotency-Key` / `client_reading_id`)
    - LINE LIFF API (`/api/v1/liff/bills`, `/api/v1/liff/link`)
    - Auth Logout + JWT Blacklist (`POST /api/v1/auth/logout` -> Token เดิมเรียกซ้ำต้องได้ `401 Unauthorized`)
    - Swagger UI เปิดเมื่อ `APP_ENV != "production"` และได้ `404` เมื่อ `APP_ENV == "production"`

### Task 5: Frontend Core Modules — Offline-First Store, Bluetooth ESC/POS Printer, Hybrid OCR (TDD)
- **Files:**
  - `frontend-react/src/features/billing/utils/waterBillCalculator.test.ts`
  - `frontend-react/src/features/billing/utils/waterBillCalculator.ts`
  - `frontend-react/src/features/offline/offlineStore.test.ts`
  - `frontend-react/src/features/offline/offlineStore.ts`
  - `frontend-react/src/features/printer/escpos.test.ts`
  - `frontend-react/src/features/printer/escpos.ts`
  - `frontend-react/src/features/ocr/meterOcr.test.ts`
  - `frontend-react/src/features/ocr/meterOcr.ts`
- **Verification:** `cd frontend-react && npm test -- --run`

### Task 6: Frontend UI (`shadcn/ui` & `v0.app` style) + LINE LIFF Portal (TDD)
- **Files:**
  - `frontend-react/src/app/App.tsx`
  - `frontend-react/src/features/master-data/MasterDataPage.tsx` (อบต., ตำบล, หมู่บ้าน, บ้านเลขที่, เจ้าของบ้าน + Avatar Upload & Default Avatar)
  - `frontend-react/src/features/tariffs/TariffsAndMetersPage.tsx` (หน่วยและอัตราค่าน้ำขั้นบันได, รอบบิล, ทะเบียนมิเตอร์น้ำ)
  - `frontend-react/src/features/field-reader/FieldMeterReaderPage.tsx` (จดมิเตอร์ Offline-First, กล้องถ่ายรูป + AI OCR, คำนวณค่าน้ำ, พิมพ์บิล Bluetooth ESC/POS)
  - `frontend-react/src/features/liff/LiffResidentPortalPage.tsx` (หน้า LINE LIFF สำหรับเจ้าของบ้านดูข้อมูลค่าน้ำและประวัติการชำระเงิน)
  - `frontend-react/src/e2e/app.test.tsx`
- **Verification:** `cd frontend-react && npm test -- --run && npm run build`

### Task 7: Container-First Infrastructure, Keycloak Custom Tailwind Login Theme & Docker Compose Demo
- **Files:**
  - `deploy/docker-compose.yml`
  - `deploy/keycloak/realm-water.json`
  - `deploy/keycloak/themes/water-smart-bill/login/theme.properties`
  - `deploy/keycloak/themes/water-smart-bill/login/login.ftl`
  - `deploy/keycloak/themes/water-smart-bill/login/resources/css/login-tailwind.css`
  - `deploy/nginx/default.conf`
  - `deploy/postgres/init/01-init.sh`
  - `Makefile` & `README.md`
