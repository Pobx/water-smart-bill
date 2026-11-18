# ADR 0002: สถาปัตยกรรมระบบบริหารจัดการน้ำประปา อบต. (Water Smart Bill Architecture & PIOS Evolution)

## Status
Accepted (วันที่ 2026-11-18)

## Context
องค์การบริหารส่วนตำบล (อบต.) ต้องการระบบบริหารจัดการน้ำประปา (`water-smart-bill`) ที่ต่อยอดจากโมดูล `tabwater` ของระบบ `pios` โดยต้องรองรับ:
1. การบันทึกข้อมูล อบต. (`organizations`), ตำบล (`provinces`, `districts`, `tambons`), หมู่บ้าน (`zones`), คุ้ม/สายจดมิเตอร์ (`subzones`), บ้านเลขที่และเจ้าของบ้าน (`users`) พร้อมรูป Avatar (หากไม่อัปโหลดต้องมี Default Avatar อัตโนมัติ)
2. การกำหนดอัตราค่าน้ำแบบขั้นบันได (`tw_meter_types`, `tw_meter_type_rate_configs`, `tw_meter_type_rate_tiers`) และการเปิดรอบบิล (`invoice_period`)
3. การขึ้นทะเบียนมิเตอร์น้ำ (`tw_meter_infos`), การจดเลขมิเตอร์และคำนวณค่าน้ำอัตโนมัติ (`tw_invoice`)
4. การใช้งานแบบ Container-First ด้วย Docker Compose และเปิด Swagger UI เฉพาะ Non-Production Environment

## Decision
1. **Modular Hexagonal Architecture (Go 1.23 + Echo v4 + PostgreSQL 16)**:
   - แยกชั้น `internal/domain`, `internal/app`, `internal/adapter/in/http`, และ `internal/adapter/out/{postgres,redis,keycloak,ocr,storage}` อย่างชัดเจน
   - บังคับใช้ Multi-Tenant Isolation ด้วย `org_id` จาก JWT Claims ควบคู่กับ PostgreSQL Row-Level Security (RLS)
2. **Frontend Stack (React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui)**:
   - ออกแบบ UI ด้วยแนวคิดของ `shadcn/ui` และ `v0.app` แยกพื้นที่ใช้งานสำหรับเจ้าหน้าที่ อบต./คนจดมิเตอร์ และหน้าพอร์ทัลลูกบ้านผ่าน LINE LIFF (`/liff/*`)
3. **Local Volume Storage & Automatic Default Avatar**:
   - เก็บไฟล์อัปโหลด (รูป Avatar เจ้าของบ้านและรูปถ่ายหน้าปัดมิเตอร์) ลงใน Local Volume (`/data/uploads`) ของ Backend Container
   - หากเจ้าของบ้านไม่ได้อัปโหลดรูป ระบบจะสร้างและคืนค่า Default Avatar SVG อัตโนมัติ (`/api/v1/avatars/default?name=...`)
4. **Non-Prod Swagger Governance**:
   - เปิดเส้นทาง `/swagger/*` และ `/api/v1/openapi.yaml` เฉพาะเมื่อ `APP_ENV != "production"` เท่านั้น หากเป็น `production` จะปิดการเข้าถึงโดยอัตโนมัติ

## Consequences
- **Positive:** โครงสร้างโค้ดสะอาด ทดสอบแยกเลเยอร์ด้วย TDD ได้ 100% และรันด้วย Docker Compose ได้ทันทีโดยไม่พึ่งพา Cloud Storage ภายนอก
- **Negative:** การเก็บไฟล์ใน Local Volume ต้องทำ Backup Volume คู่กับฐานข้อมูลเมื่อนำไปรันจริง
- **Constraints (สำหรับ AI Agent):**
  - ห้ามเขียน Business Logic หรือสูตรคำนวณค่าน้ำใน HTTP Handler ต้องอยู่ใน `internal/domain` เท่านั้น
  - ทุกครั้งที่แก้ไขโครงสร้างตารางใน `backend/db/migrations/` ต้องอัปเดต `docs/database/schema.md` เสมอ
  - ห้ามเปิดใช้งาน Swagger Endpoint เมื่อ `APP_ENV=production` อย่างเด็ดขาด
