# ADR 0010: ระบบทดสอบ Golden Master Suite, Auto-Migration Runner ด้วย Checksum และสคริปต์ Docker ข้ามแพลตฟอร์ม

## Status
Accepted (วันที่ 2026-11-24)

## Context
เพื่อป้องกันการถดถอยของผลการคำนวณค่าน้ำแบบขั้นบันไดและรูปแบบใบเสร็จความร้อน (Thermal Receipt) รวมถึงแก้ปัญหาการรัน SQL Migrations ไม่ครบทุกไฟล์และการรันระบบบนทั้ง macOS/Linux และ Windows จึงต้องวางมาตรฐานระบบทดสอบ Golden Master และระบบ Automation

## Decision
1. **Golden Master Testing Suite:**
   - **Backend (`backend-go/application/golden_test.go`):** ตรวจสอบผลลัพธ์การคำนวณค่าน้ำแบบขั้นบันไดเทียบกับ `testdata/progressive_water_bill.golden.json` และรูปแบบใบเสร็จเทียบกับ `testdata/thermal_receipt.golden.txt`
   - **Frontend (`frontend-react/src/e2e/golden.test.tsx`):** ตรวจสอบ Snapshot ของหน้าจอหลักด้วย Vitest Snapshot (`__snapshots__/golden.test.tsx.snap`)
2. **Checksum-Based Auto-Migration Runner (`backend-go/adapters/sqldb/migrate.go`):**
   - ค้นหาไฟล์ `*.up.sql` ทั้งหมดใน `backend-go/db/migrations/` เรียงตามลำดับชื่อไฟล์ (`000001`, `000002`, `000003`, ...)
   - ใช้ PostgreSQL Advisory Lock (`pg_advisory_lock(727001)`) และตาราง `schema_migrations` เก็บค่า SHA-256 Checksum (หลัง Normalize CRLF เป็น LF) เพื่อรันเฉพาะไฟล์ที่ยังไม่เคยรันหรือมีการเปลี่ยนแปลง
3. **Cross-Platform Docker & Local Scripts (`.gitattributes`, `docker-up.sh/.bat`, `run-local.sh/.bat`):**
   - บังคับ Line Endings ด้วย `.gitattributes` (`eol=lf` สำหรับ `.sh`, `Dockerfile`, `.sql`, `.go`, `.ts` และ `eol=crlf` สำหรับ `.bat`)
   - รองรับคำสั่ง `rebuild` ใน `docker-up.sh` และ `docker-up.bat`

## Consequences
- **Positive:** ฐานข้อมูลรันครบทุก Migration อัตโนมัติ, ตรวจจับความผิดพลาดของการคำนวณค่าน้ำและ UI Snapshot ได้ทันที และรันบน Windows/macOS/Linux ได้โดยไม่เกิดปัญหา CRLF
- **Negative:** เมื่อมีการแก้ไขโครงสร้าง UI หรือสูตรคำนวณอย่างตั้งใจ ต้องอัปเดตไฟล์ Golden Master ควบคู่กับ ADR
- **Constraints (สำหรับ AI Agent):**
  - ทุกไฟล์ SQL Migration ใหม่ใน `backend-go/db/migrations/*.up.sql` ต้องเขียนแบบ Idempotent (`IF NOT EXISTS`) เสมอเพื่อให้ `migrate.go` รันซ้ำได้อย่างปลอดภัย
  - ห้ามแก้ไขค่าในไฟล์ `.golden.json`, `.golden.txt` หรือ `.snap` โดยไม่ผ่านการอนุมัติแผนและบันทึก ADR
