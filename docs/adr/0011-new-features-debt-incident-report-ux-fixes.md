# ADR 0011: ฟีเจอร์ใหม่จาก Feedback Review — Debt Management, Incident Reporting, Report Export และ UX Fixes

## Status
Accepted (วันที่ 2026-11-28)

**คำตอบจาก PO (2026-11-28):**
1. Debt Notice = แสดงใน UI เท่านั้น (ไม่ใช้ LINE Messaging API)
2. Incident Map = ไม่มี Google Maps ใน Phase นี้; ใช้ Browser Geolocation + link ธรรมดา + ถ่ายภาพ 1 รูป + textarea
3. Role การเงิน = `finance_staff` ที่มีอยู่ใน Keycloak (ถ้าไม่มีให้เพิ่ม)
4. overdue_threshold = admin กำหนดได้, default = 2 รอบ
5. Excel = plain table (SheetJS ไม่ต้องมี logo)

## Context
จากการ Demo ระบบ Water Smart Bill v1 และรับ Feedback บันทึกในไฟล์ `check_feature_ระบบประปา.pdf` พบว่าระบบยังขาด Workflow สำคัญในการบริหารจัดการหนี้ค้างชำระ, ช่องทางสื่อสารระหว่าง Resident กับ Staff และรายงานทางการเงิน นอกจากนี้ยังมี UX Issues ที่ทำให้ Staff ทำงานได้ไม่มีประสิทธิภาพ ได้แก่ Dropdown มิเตอร์ที่ค้นหาไม่ได้ และไม่มีการแยกสถานะ "บันทึกแล้ว" กับ "ยังไม่บันทึก"

Feature ที่ต้องพัฒนามี 8 รายการ จัดเป็น 3 กลุ่ม:
1. **UX / Bug Fixes:** Searchable Meter + Route, Status Tabs, VAT/Tier Edit
2. **Business Logic:** Bulk Payment รวมหลายรอบ, Debt Notice + ตัดมิเตอร์ 
3. **New Features:** Incident Reporting (GPS), Daily Collection Report + Excel Export

## Decision

### โครงสร้าง Feature ใหม่ (Vertical Slice Architecture)

```
frontend-react/src/features/
  ├── field-reader/          (แก้ไข: Searchable Meter, Status Tabs)
  ├── master-data/           (แก้ไข: VAT/Tier Edit)
  ├── finance-cashier/       (แก้ไข: Bulk Payment รวมรอบ)
  ├── debt-management/       🆕 (Debt Notice + ตัดมิเตอร์)
  ├── incidents/             🆕 (แจ้งเหตุ / รับแจ้งเหตุ GPS)
  └── reports/               🆕 (รายงาน + Export Excel)
```

### DB Migrations ที่ต้องสร้าง

```
backend-go/db/migrations/
  ├── 0011-add-meter-routes.sql
  ├── 0012-add-route-id-to-meter-infos.sql
  ├── 0013-add-meter-status-disconnection.sql
  ├── 0014-add-payment-batches.sql
  ├── 0015-add-debt-notices.sql
  └── 0016-add-incidents.sql
```

### Backend API Endpoints ใหม่

| Method | Path | Role | Feature |
|--------|------|------|---------|
| GET | `/meter-routes` | staff, admin | ดึงเส้นทางที่ผูกกับ staff |
| GET | `/users/:id/outstanding` | finance, admin | ดึง unpaid invoices รวม |
| POST | `/payments/bulk` | finance, admin | รับชำระหลายรอบ atomic |
| POST | `/debt-notices` | admin | สร้างใบแจ้งเตือน |
| PATCH | `/debt-notices/:id/cut` | staff | บันทึกการตัดมิเตอร์ |
| PATCH | `/debt-notices/:id/restore` | staff | บันทึกการเปิดมิเตอร์คืน |
| GET | `/incidents` | staff, admin | รายการแจ้งเหตุ |
| POST | `/incidents` | user (LIFF) | แจ้งเหตุใหม่ |
| PATCH | `/incidents/:id/assign` | staff | รับงาน |
| PATCH | `/incidents/:id/resolve` | staff | ปิดงาน |
| GET | `/reports/daily-collection` | finance, admin | รายงานรับชำระ + Export |

### Security Decisions

- **Debt Notice / ตัดมิเตอร์:** ต้องผ่าน `org_id` RLS บน PostgreSQL และ Middleware ตรวจ role
- **Incident GPS:** lat/lng ต้องไม่ถูก log ใน application logs (evidence-hygiene)
- **Bulk Payment:** ใช้ DB Transaction + idempotency `batch_payment_id` ป้องกัน double-pay
- **Report Export:** เฉพาะ finance_staff / admin ของ org เดียวกัน ตรวจ CSV injection ด้วย SheetJS

### Library เพิ่ม

| Library | เหตุผล |
|---------|--------|
| `xlsx` (SheetJS) | Export Excel บน Frontend |
| Radix UI Combobox หรือ `cmdk` | Searchable Meter Select |

## Consequences

- **Positive:**
  - ครบ Workflow การจัดการหนี้ตั้งแต่ แจ้งเตือน → ตัด → ชำระ → เปิดคืน
  - Staff ทำงานเร็วขึ้นด้วย Searchable Meter + Route Filter
  - Finance มีรายงานและ Export Excel ใช้งานได้จริง
  - Resident มีช่องทางแจ้งเหตุพร้อม GPS location

- **Negative:**
  - เพิ่ม 6 Migration files และ 11 API endpoints ใหม่
  - Frontend ต้องสร้าง 3 feature folder ใหม่ (debt-management, incidents, reports)
  - ต้องทดสอบ Race Condition บน Bulk Payment

- **Constraints (สำหรับ AI Agent):**
  1. ห้ามสร้าง Endpoint ตัดมิเตอร์โดยไม่ตรวจสอบ `debt_notice_id` ที่มีอยู่จริงใน DB
  2. ห้าม log lat/lng ใน application logs หรือ error responses ทุกกรณี (hunt-evidence-hygiene)
  3. ทุก API ใหม่ต้องมี `org_id` ใน WHERE clause เสมอ — ห้ามใช้ User ID อย่างเดียวโดยไม่มี org scope
  4. Bulk Payment ต้องใช้ `BEGIN...COMMIT` transaction block ใน PostgreSQL เสมอ
  5. Role `finance_staff` เท่านั้นที่เข้าถึง `/reports/*` ห้าม Staff ทั่วไปเข้าถึง
  6. Incident ของ Resident ต้องกรองด้วย `reporter_user_id = current_user_id` เสมอเมื่อ role = user
  7. VAT/Tier Edit endpoint ต้องป้องกันด้วย `RequireRole("admin")` เท่านั้น
