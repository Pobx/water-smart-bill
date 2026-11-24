# ADR 0009: ระบบควบคุมสิทธิ์รายบทบาท (RBAC Middleware & Left Menu), Mobile Card Views และนโยบายรับชำระด้วยเงินสดเท่านั้น (Cash-Only Policy)

## Status
Accepted (วันที่ 2026-11-24)

## Context
หลังจากเปิดใช้งานระบบพื้นฐานตาม ADR 0002–0008 พบความต้องการด้านความปลอดภัยของการแบ่งแยกหน้าที่เจ้าหน้าที่ อบต. และการปรับปรุง UX บนอุปกรณ์มือถือภาคสนาม ดังนี้:
1. **Role-Based Access Control (RBAC):** เจ้าหน้าที่แต่ละตำแหน่ง (`admin`, `tabwater_staff`, `finance_staff`, `user`) ต้องเข้าถึงเฉพาะ API และเมนูที่ตรงกับบทบาทของตนเท่านั้น
2. **Mobile Responsive Card Views:** การแสดงผลแบบตาราง (`<table>`) บนหน้าจอสมาร์ทโฟนของเจ้าหน้าที่ภาคสนามทำให้อ่านข้อมูลยากและต้องเลื่อนแนวนอน
3. **Cash-Only Payment Policy:** สำนักงาน อบต. ต้องการปิดช่องทางชำระผ่าน QR PromptPay ชั่วคราวและบังคับรับชำระด้วยเงินสด (`CASH`) เท่านั้นเพื่อความแม่นยำในการกระทบยอดเงินสดหน้าเคาน์เตอร์ (ปรับปรุงจาก ADR 0006)
4. **Avatar Upload Hardening (`hunt-file-upload` & `hunt-xss`):** การอัปโหลดรูป Avatar เจ้าของบ้านต้องตรวจสอบ MIME type, นามสกุลไฟล์, ขนาดไฟล์สูงสุด 5MB และป้องกัน `javascript:` URI ตามกฎ `Claude-BugHunter`

## Decision
1. **Single-Parameter `RequireRoles(allowedRoles []string)` Middleware:** สร้าง Echo Middleware ใน `backend-go/adapters/web/rest/server.go` ที่ตรวจสอบสิทธิ์จาก `application.Claims` ราย Endpoint:
   - `admin` / `super_admin`: จัดการข้อมูล อบต., หมู่บ้าน, ตารางอัตราค่าน้ำ และเปิดงวดบิล
   - `tabwater_staff` / `admin`: จัดการทะเบียนผู้ใช้น้ำ, มิเตอร์, ดึง Offline Bundle, OCR และบันทึกเลขมิเตอร์
   - `finance_staff` / `admin`: รับชำระเงินค่าน้ำและออกรายงานสรุปการจัดเก็บ (JSON/CSV)
2. **Dynamic Left Menu Sidebar & Mobile Drawer Navigation:** ปรับ Layout ของ `frontend-react` ให้ใช้แถบเมนูด้านซ้าย (Left Sidebar บน Desktop และ Slide-over Drawer บน Mobile) ที่กรองเมนูตาม Role ของผู้ใช้งานอัตโนมัติ
3. **Mobile Card Views (`< md`):** เปลี่ยนการแสดงผลตารางข้อมูลบนหน้าจอมือถือให้เป็น Card View ในทุกหน้าจอหลัก (`MasterDataScreen`, `TariffsMetersScreen`, `FinanceCashierScreen`)
4. **Cash-Only Cashier Desk:** ปิดตัวเลือก QR PromptPay ในหน้าโต๊ะการเงินชั่วคราว และบังคับการรับชำระเงินเป็นเงินสด (`CASH`) เท่านั้น
5. **Strict Avatar Upload Validation:** จำกัดขนาดไฟล์ไม่เกิน 5MB, อนุญาตเฉพาะนามสกุล `.png`, `.jpg`, `.jpeg`, `.webp` ที่ผ่านการตรวจ Magic-Byte MIME Type (`http.DetectContentType`) และอนุญาตเฉพาะ `avatar_url` ที่ใช้ Scheme ปลอดภัย (`/`, `http://`, `https://`, `data:image/(png|jpeg|webp);base64,`)

## Consequences
- **Positive:** ป้องกันการเรียกใช้งาน API ข้ามบทบาท (Privilege Escalation), ใช้งานบนมือถือภาคสนามได้โดยไม่ต้องเลื่อนตารางแนวนอน และปิดช่องโหว่ Stored XSS จากการอัปโหลดไฟล์อันตราย
- **Negative:** ช่องทางชำระเงินผ่าน QR PromptPay ถูกปิดไว้ชั่วคราวจนกว่าจะเปิดใช้งานระบบเชื่อมต่อธนาคารอัตโนมัติ
- **Constraints (สำหรับ AI Agent):**
  - ทุก Endpoint ใหม่ที่เปลี่ยนแปลงข้อมูลต้องระบุ `RequireRoles(...)` ให้ตรงกับบทบาทเสมอ
  - ห้ามใช้ `<table>` บนหน้าจอขนาดเล็กกว่า `md` โดยไม่มี Mobile Card View รองรับ
  - ห้ามรับไฟล์อัปโหลดโดยไม่ตรวจสอบทั้งนามสกุลไฟล์และ Magic-Byte MIME Type (`hunt-file-upload`)
