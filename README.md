# Water Smart Bill — ระบบบริหารจัดการค่าน้ำประปาสำหรับ อบต.

ระบบบริหารจัดการน้ำประปาอัจฉริยะสำหรับองค์การบริหารส่วนตำบล (อบต.) พร้อมระบบจดมิเตอร์ออฟไลน์ (Offline-First), ตัวช่วยอ่านเลขมิเตอร์ AI OCR, เครื่องพิมพ์บิล Bluetooth และพอร์ทัลลูกบ้าน LINE LIFF

---

## ฟีเจอร์หลัก (Key Features)

1. **จัดการข้อมูลพื้นฐาน อบต. และครัวเรือน (`Master Data & Homeowners`)**:
   - บันทึกข้อมูล อบต. (`organizations`), ตำบล/อำเภอ/จังหวัด (`tambons`, `districts`, `provinces`), หมู่บ้าน (`zones`) และสายจดมิเตอร์ (`subzones`)
   - บันทึกบ้านเลขที่และเจ้าของบ้าน (`users`) พร้อมรูป Avatar (หากไม่ได้อัปโหลดรูปเข้ามา ระบบสร้าง **Default Avatar SVG** ให้อัตโนมัติ)
2. **จัดการหน่วยน้ำ อัตราค่าน้ำขั้นบันได และมิเตอร์น้ำ (`Tariffs & Water Meters`)**:
   - กำหนดอัตราค่าน้ำแบบขั้นบันได (`tw_meter_type_rate_tiers`) + ค่ารักษามิเตอร์ + VAT 7%
   - เปิดงวดบิลประจำเดือน (`invoice_period`) และขึ้นทะเบียนมิเตอร์น้ำ (`tw_meter_infos`)
3. **จดมิเตอร์แบบ Offline-First + AI OCR + พิมพ์บิล Bluetooth (`Field Meter Reader`)**:
   - รองรับการทำงานแบบ **Offline-First** เก็บคิวการจดมิเตอร์ในเครื่องพร้อม `client_reading_id` (`Idempotency-Key`) และซิงค์ขึ้นเซิร์ฟเวอร์เมื่อมีสัญญาณอินเทอร์เน็ต
   - รองรับการถ่ายรูปหน้าปัดมิเตอร์และอ่านเลขหน่วยด้วย **Hybrid OCR**
   - ออกบิลค่าน้ำทันทีหลังบันทึกมิเตอร์ผ่าน **เครื่องพิมพ์ Bluetooth พกพา (Web Bluetooth ESC/POS 58mm/80mm)**
4. **พอร์ทัลตรวจสอบค่าน้ำสำหรับเจ้าของบ้านผ่าน LINE LIFF (`Resident Portal`)**:
   - เจ้าของบ้านตรวจสอบยอดค้างชำระ ประวัติการใช้น้ำ และใบเสร็จผ่าน LINE LIFF (`/liff`)
5. **ความปลอดภัย Keycloak OIDC + Session Revocation + Dynamic RBAC**:
   - ควบคุมสิทธิ์การเข้าถึงด้วย **Role-Based Access Control (RBAC)** ทั้งในระดับ API Endpoints และเมนูด้านซ้าย (Left Menu) ของหน้าเว็บ
   - เมื่อกด Logout (`POST /api/v1/auth/logout`) ระบบเพิกถอนเซสชัน Token ทันที
   - ปรับแต่งหน้า Login ของ Keycloak ด้วย Tailwind CSS (`deploy/keycloak/themes/water-smart-bill/login/`)
   - เปิดใช้งาน Swagger UI (`/swagger/index.html`) เฉพาะ Non-Production (`APP_ENV != production`)

---

## เอกสารโครงการและสถาปัตยกรรม (Documentation)

- [Product Requirements Document (PRD)](docs/PRD.md)
- [Software Requirements Specification (SRS)](docs/SRS.md)
- [Database Schema Documentation](docs/database/schema.md)
- [Architecture Decision Records (ADRs)](docs/adr/README.md)
- [Approved System Design Spec](docs/superpowers/specs/2026-11-18-water-smart-bill-design.md)
- [Implementation Plan](docs/superpowers/plans/2026-11-18-water-smart-bill-implementation.md)

---

## การรันทดสอบและใช้งาน (Quick Start)

### วิธีที่ 1: รันบนเครื่องคอมพิวเตอร์ของคุณ (1-Click Local Run)
```bash
# สำหรับ macOS / Linux:
./run-local.sh

# สำหรับ Windows:
ดับเบิ้ลคลิกไฟล์ run-local.bat หรือรันใน Command Prompt
```

### รันทั้งระบบด้วย Docker Compose (Postgres + Redis + Keycloak + API + Frontend + Nginx)
```bash
# macOS / Linux:  ./docker-up.sh [up|down|logs|reset]
# Windows:        docker-up.bat [up|down|logs|reset]
# เปิดเว็บที่ http://localhost (ต้องติดตั้งและเปิด Docker Desktop ก่อน)
```

### วิธีที่ 2: รันผ่านคำสั่งปกติ
```bash
# รันชุดทดสอบทั้งหมด (Go Backend + React Frontend)
make test

# รันเฉพาะ Frontend React
cd frontend-react && npm install && npm run dev

# รันระบบทั้งหมดด้วย Docker Compose (Keycloak + Postgres + Redis + API + Frontend)
make up
```

