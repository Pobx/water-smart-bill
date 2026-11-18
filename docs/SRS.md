# Software Requirements Specification (SRS) — Water Smart Bill

## 1. บทนำ (Introduction)
เอกสาร SRS ฉบับนี้ระบุข้อกำหนดทางเทคนิค ฟังก์ชันการทำงาน (Functional Requirements) และข้อกำหนดด้านคุณภาพระบบ (Non-Functional Requirements) ของระบบ **Water Smart Bill** สำหรับองค์การบริหารส่วนตำบล (อบต.) โดยอ้างอิงโครงสร้างฐานข้อมูลและโดเมนจากระบบ `pios`

---

## 2. สถาปัตยกรรมและเทคโนโลยี (Technology Stack & Codebase Architecture)
- **Frontend:** React 18 (TypeScript) + Vite + Tailwind CSS + `shadcn/ui` & `v0.app` Design System + IndexedDB Offline Queue + Web Bluetooth API (ESC/POS) + LINE LIFF View
  - **Frontend Architecture Standard:** **Vertical Slice Architecture** อ้างอิงตาม [Martin Piliar — Vertical Slice Architecture Guide](https://www.piliar.me/blog/vertical-slice-architecture-react-native/) โดยจัดกลุ่มโค้ดตาม Feature Slice ภายใต้ `frontend-react/src/features/<slice>/` แต่ละ Slice ประกอบด้วย `<Feature>Screen.tsx` (View), `use<Feature>.ts` (State & Logic Hook), `<feature>Api.ts` (API Client), และ `index.ts` (Public Barrel Export) แยกจาก `src/shared/` อย่างชัดเจน
- **Backend:** Golang 1.23 + Echo v4 Framework
  - **Backend Architecture Standard:** **Hexagonal Architecture (Ports & Adapters)** อ้างอิงตาม [Vinícius A dos Santos — Hexagonal Architecture with Golang](https://vinisantos.dev/posts/hexagonal-architecture-with-golang) โดยแยกชั้น `application/` (Domain Entities + `IsValid()`, `application/ports/` สำหรับ Inbound Service Port & Outbound Persistence/Auth/Blacklist Port, และ `application/services/` สำหรับ Service Implementation) ออกจากชั้น `adapters/` (`adapters/dto/` พร้อม `Bind()` & `ConvertToEntity()`, `adapters/web/rest/handler/`, `adapters/web/rest/server.go`, `adapters/sqldb/`, `adapters/memory/`, `adapters/keycloak/`, `adapters/blacklist/`)
- **Database:** PostgreSQL 16 (พร้อม Row-Level Security แยกตาม `org_id`)
- **Authentication & Security:** Keycloak 26 OIDC + Redis 7 JWT Blacklist (เมื่อ Logout) + Custom Keycloak Login Theme ด้วย Tailwind CSS
- **API Documentation:** OpenAPI 3.0 / Swagger UI เปิดใช้งานเฉพาะ Non-Production (`APP_ENV != "production"`)
- **Deployment:** Container-First & Docker Compose (`deploy/docker-compose.yml`)

---

## 3. ข้อกำหนดด้านฟังก์ชัน (Functional Requirements)

### FR-01: การจัดการข้อมูล อบต., ตำบล, หมู่บ้าน และเจ้าของบ้าน
- **FR-01.1:** ระบบต้องสามารถดูและบันทึกข้อมูล อบต. (`organizations`), จังหวัด (`provinces`), อำเภอ (`districts`), ตำบล (`tambons`), หมู่บ้าน (`zones`) และคุ้ม/สายจดมิเตอร์ (`subzones`) ได้
- **FR-01.2:** ระบบต้องสามารถบันทึกข้อมูลเจ้าของบ้าน (`users`) ซึ่งประกอบด้วย คำนำหน้า, ชื่อ-นามสกุล, บ้านเลขที่ (`house_no`), ที่อยู่, หมู่บ้าน, ตำบล, เบอร์โทรศัพท์, `line_user_id` และรูปโปรไฟล์ (`avatar_url`)
- **FR-01.3 (Default Avatar Rule):** หากไม่มีการอัปโหลดรูปภาพเจ้าของบ้านเข้ามา ระบบต้องกำหนดค่า Default Avatar (`/api/v1/avatars/default?name=...` หรือ SVG Avatar มาตรฐาน) ให้โดยอัตโนมัติทั้งในระดับ API Response และหน้าจอ UI

### FR-02: การจัดการหน่วยน้ำ อัตราค่าน้ำ และรอบบิล
- **FR-02.1:** ระบบต้องรองรับการกำหนดประเภทมิเตอร์ (`tw_meter_types`) และตารางอัตราค่าน้ำแบบขั้นบันได (`tw_meter_type_rate_configs`, `tw_meter_type_rate_tiers`)
- **FR-02.2:** สูตรการคำนวณค่าน้ำประปาอัตราก้าวหน้า (`CalculateProgressiveWaterBill`):
  - คำนวณหน่วยน้ำที่ใช้: $\text{UnitsUsed} = \max(0, \text{CurrentMeter} - \text{LastMeter})$
  - คำนวณค่าน้ำแต่ละขั้นบันได (`tier_order`) ตามช่วงหน่วย `min_units` ถึง `max_units` คูณด้วย `rate_per_unit`
  - รวมค่ารักษามาตรวัดน้ำ (`reserve_fee`) เป็นยอดก่อนภาษี: $\text{SubTotal} = \text{WaterCharge} + \text{ReserveFee}$
  - คำนวณภาษีมูลค่าเพิ่ม: $\text{VAT} = \text{round}_2(\text{SubTotal} \times \frac{\text{VatPercent}}{100})$
  - ยอดชำระสุทธิ: $\text{TotalPayable} = \text{round}_2(\text{SubTotal} + \text{VAT})$
- **FR-02.3:** ระบบต้องสามารถเปิดงวดบิลประจำเดือน (`invoice_period`) ได้

### FR-03: การจัดการมิเตอร์น้ำ การบันทึกเลขมิเตอร์ และ OCR
- **FR-03.1:** ระบบต้องสามารถขึ้นทะเบียนมิเตอร์น้ำ (`tw_meter_infos`) ผูกกับเจ้าของบ้าน (`user_id`), หมู่บ้าน (`undertake_zone_id`), ประเภทมิเตอร์ (`metertype_id`) และเลขมิเตอร์ตั้งต้น (`last_meter_recording`) ได้
- **FR-03.2:** ระบบต้องป้องกันการกรอกเลขมิเตอร์ครั้งนี้ (`current_meter`) ที่น้อยกว่าเลขมิเตอร์ครั้งก่อน (`last_meter_recording`) ยกเว้นกรณีเปลี่ยนมิเตอร์ใหม่
- **FR-03.3 (Optional OCR):** ระบบต้องมีฟังก์ชันถ่ายรูปหรืออัปโหลดรูปหน้าปัดมิเตอร์น้ำ เพื่ออ่านค่าตัวเลขมิเตอร์จากภาพ (Hybrid OCR: รองรับทั้งการประมวลผลบน Browser ขณะ Offline และเรียก `POST /api/v1/tabwater/ocr/meter-read` ขณะ Online) พร้อมบันทึกภาพหลักฐานคู่กับบิล

### FR-04: การทำงานแบบ Offline-First และการซิงค์ข้อมูล
- **FR-04.1:** หน้าเว็บแอปพลิเคชันต้องสามารถดาวน์โหลดชุดข้อมูลสำหรับทำงานภาคสนาม (`GET /api/v1/tabwater/offline-bundle`) ลงเก็บไว้ใน Local Storage / IndexedDB ได้
- **FR-04.2:** เมื่ออยู่ในสถานะ Offline เจ้าหน้าที่ต้องสามารถค้นหามิเตอร์ กรอกเลขมิเตอร์ (หรือใช้ On-Device OCR) คำนวณค่าน้ำทันที และบันทึกรายการลงคิว `pending_readings` พร้อมสร้าง `client_reading_id` (UUID)
- **FR-04.3:** เมื่อกลับมา Online ระบบต้องสามารถซิงค์รายการทั้งหมดผ่าน `POST /api/v1/tabwater/readings/sync` โดยเซิร์ฟเวอร์ต้องตรวจสอบ `client_reading_id` เพื่อรับประกันความไม่ซ้ำซ้อน (Idempotency)

### FR-05: การพิมพ์บิลค่าน้ำผ่านเครื่องพิมพ์ Bluetooth
- **FR-05.1:** หลังจากบันทึกเลขมิเตอร์น้ำ (ทั้งโหมด Online และ Offline) เจ้าหน้าที่ต้องสามารถกดสั่งพิมพ์ใบแจ้งหนี้ค่าน้ำประปาผ่านเครื่องพิมพ์ Bluetooth พกพา (มาตรฐาน ESC/POS 58mm/80mm ผ่าน Web Bluetooth API) หรือพิมพ์ผ่านระบบพิมพ์มาตรฐานของเบราว์เซอร์ได้ทันที
- **FR-05.2:** ใบแจ้งหนี้ที่พิมพ์ต้องแสดง ชื่อ อบต., เลขที่บิล, งวดบิล, ชื่อเจ้าของบ้าน, บ้านเลขที่/หมู่บ้าน, เลขมิเตอร์ก่อน-หลัง, หน่วยที่ใช้, ค่าน้ำ, ค่ารักษามิเตอร์, VAT, ยอดรวมสุทธิ และ QR Code สำหรับตรวจสอบ/ชำระเงินผ่าน LINE LIFF

### FR-06: ระบบพอร์ทัลเจ้าของบ้านผ่าน LINE LIFF
- **FR-06.1:** เจ้าของบ้านต้องสามารถเข้าดูข้อมูลการใช้น้ำและประวัติการชำระค่าน้ำของบ้านตนเองผ่านหน้า LINE LIFF (`/liff`) โดยอ้างอิง `line_user_id` หรือค้นหาด้วยเลขมิเตอร์/บ้านเลขที่
- **FR-06.2:** เจ้าของบ้านสามารถผูกบัญชี LINE (`line_user_id`) เข้ากับทะเบียนผู้ใช้น้ำของตนเอง และดูใบแจ้งหนี้ รูปถ่ายมิเตอร์ รวมถึงใบเสร็จรับเงินได้

### FR-07: ระบบยืนยันตัวตน Keycloak, JWT Blacklist และ Custom Login Page
- **FR-07.1:** ระบบต้องใช้ Keycloak OIDC ในการยืนยันตัวตน พร้อมปรับแต่งหน้า Login ด้วย Tailwind CSS (`deploy/keycloak/themes/water-smart-bill/login/`)
- **FR-07.2:** เมื่อผู้ใช้งานกด Logout (`POST /api/v1/auth/logout`) ระบบต้องนำ `jti` (หรือ Token Digest) ของ JWT ไปบันทึกใน Redis Blacklist จนกว่า Token จะหมดอายุ และปฏิเสธทุกคำขอที่ใช้ Token ดังกล่าวด้วยสถานะ `401 Unauthorized`

---

## 4. ข้อกำหนดด้าน API (RESTful API Endpoints Summary)

| Method | Endpoint | คำอธิบาย | สิทธิ์การเข้าถึง |
| :--- | :--- | :--- | :--- |
| `GET` | `/healthz`, `/readyz` | ตรวจสอบสถานะความพร้อมของระบบ | Public |
| `GET` | `/swagger/*`, `/api/v1/openapi.yaml` | เอกสาร Swagger UI (เปิดเฉพาะ `APP_ENV != production`) | Non-Prod Only |
| `POST` | `/api/v1/auth/logout` | เพิกถอน JWT เข้าสู่ Redis Blacklist เมื่อ Logout | Authenticated |
| `GET` | `/api/v1/me` | ดึงข้อมูลผู้ใช้งานปัจจุบันจาก JWT | Authenticated |
| `GET/POST` | `/api/v1/organizations` | ดูและบันทึกข้อมูล อบต. | Admin / Staff |
| `GET` | `/api/v1/locations/tambons` | ดูข้อมูลจังหวัด อำเภอ ตำบล | Authenticated |
| `GET/POST` | `/api/v1/zones` | ดูและบันทึกข้อมูลหมู่บ้าน (`zones`) และคุ้ม (`subzones`) | Admin / Staff |
| `GET/POST` | `/api/v1/users` | ดูและบันทึกข้อมูลเจ้าของบ้าน + บ้านเลขที่ + รูป Avatar | Admin / Staff |
| `POST` | `/api/v1/users/:id/avatar` | อัปโหลดรูป Avatar เจ้าของบ้าน | Admin / Staff |
| `GET` | `/api/v1/avatars/default` | สร้างรูป Default SVG Avatar อัตโนมัติเมื่อไม่มีรูปอัปโหลด | Public |
| `GET/POST` | `/api/v1/tabwater/rate-configs` | ดูและตั้งค่าอัตราค่าน้ำขั้นบันได (`tw_meter_type_rate_tiers`) | Admin / Staff |
| `GET/POST` | `/api/v1/tabwater/periods` | ดูและเปิดรอบบิลประจำเดือน (`invoice_period`) | Admin / Staff |
| `GET/POST` | `/api/v1/tabwater/meters` | ดูและขึ้นทะเบียนมิเตอร์น้ำประปา (`tw_meter_infos`) | Admin / Staff |
| `GET` | `/api/v1/tabwater/offline-bundle` | ดึงข้อมูลมิเตอร์ + เรทค่าน้ำ + รอบบิล สำหรับเก็บลง Offline IndexedDB | Staff |
| `POST` | `/api/v1/tabwater/ocr/meter-read` | อ่านเลขมิเตอร์น้ำจากรูปถ่ายด้วย OCR / Vision | Staff |
| `POST` | `/api/v1/tabwater/readings` | บันทึกเลขมิเตอร์น้ำ คำนวณค่าน้ำ และออกบิล | Staff |
| `POST` | `/api/v1/tabwater/readings/sync` | ซิงค์ข้อมูลการจดมิเตอร์แบบ Batch จากโหมด Offline (`Idempotency`) | Staff |
| `GET` | `/api/v1/tabwater/invoices` | ดูรายการใบแจ้งหนี้และใบเสร็จค่าน้ำประปา | Staff |
| `POST` | `/api/v1/tabwater/invoices/:id/pay` | รับชำระค่าน้ำประปาและออกใบเสร็จรับเงิน | Finance / Admin |
| `GET` | `/api/v1/liff/bills` | ดูข้อมูลมิเตอร์ ใบแจ้งหนี้ และประวัติการจ่ายค่าน้ำสำหรับเจ้าของบ้านผ่าน LINE LIFF | Resident (LIFF) |
| `POST` | `/api/v1/liff/link` | ผูกบัญชี LINE (`line_user_id`) เข้ากับบ้านเลขที่/เลขมิเตอร์ | Resident (LIFF) |
