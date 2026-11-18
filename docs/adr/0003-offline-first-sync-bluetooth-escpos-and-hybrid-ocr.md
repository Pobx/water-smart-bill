# ADR 0003: ระบบ Offline-First Sync, เครื่องพิมพ์ใบเสร็จ Bluetooth (ESC/POS) และ Hybrid OCR อ่านเลขมิเตอร์

## Status
Accepted (วันที่ 2026-11-18)

## Context
เจ้าหน้าที่จดมิเตอร์น้ำของ อบต. ต้องเดินจดมิเตอร์ตามหมู่บ้านซึ่งบางจุดไม่มีสัญญาณอินเทอร์เน็ต แต่ยังจำเป็นต้อง:
1. บันทึกเลขมิเตอร์น้ำและถ่ายรูปหน้าปัดมิเตอร์เป็นหลักฐานได้แม้ขณะ Offline
2. อ่านเลขหน่วยมิเตอร์จากรูปถ่ายได้ (Optional OCR) ทั้งขณะ Online และ Offline
3. คำนวณค่าน้ำประปาตามอัตราขั้นบันไดและสั่งพิมพ์ใบแจ้งหนี้/ใบเสร็จผ่านเครื่องพิมพ์ Bluetooth พกพาหน้าบ้านลูกบ้านได้ทันทีหลังบันทึกมิเตอร์
4. ซิงค์ข้อมูลกลับเข้าเซิร์ฟเวอร์โดยไม่เกิดบิลซ้ำซ้อนเมื่อกลับมาเชื่อมต่ออินเทอร์เน็ต

## Decision
1. **Offline-First Storage & Idempotent Sync**:
   - ใช้ IndexedDB บน Browser/PWA จัดการแคชข้อมูลมิเตอร์ประจำสายจด (`offline_meters`), ตารางเรทค่าน้ำ (`offline_rate_tiers`), และคิวรอซิงค์ (`pending_readings`)
   - คำนวณค่าน้ำในฝั่ง Frontend ด้วยอัลกอริทึมเดียวกับ Backend (`calculateProgressiveWaterBill`) เพื่อให้พิมพ์บิลหน้างานได้ทันทีขณะ Offline
   - ใช้ `client_reading_id` (UUID v4) เป็น `Idempotency-Key` ในการซิงค์ (`POST /api/v1/tabwater/readings/sync`) โดยฐานข้อมูลบังคับ `UNIQUE (client_reading_id)`
2. **Bluetooth Thermal Receipt Printing (Web Bluetooth ESC/POS + Fallback)**:
   - สร้างตัวแปลงข้อมูลบิลเป็นชุดคำสั่ง Byte มาตรฐาน **ESC/POS (58mm/80mm)** ส่งผ่าน Web Bluetooth API (`navigator.bluetooth`) ไปยังเครื่องพิมพ์พกพาโดยตรง พร้อม Fallback เป็นหน้าต่างพิมพ์ใบเสร็จขนาดกระดาษความร้อน (`window.print()`)
3. **Hybrid OCR Meter Reader**:
   - รองรับการสแกนตัวเลขหน้าปัดมิเตอร์แบบ Hybrid: ใช้ On-Device Digit Recognition/Tesseract.js เมื่อ Offline และเรียก Backend OCR Endpoint (`POST /api/v1/tabwater/ocr/meter-read`) เมื่อ Online โดยให้เจ้าหน้าที่ตรวจสอบและแก้ไขตัวเลขก่อนกดบันทึกได้เสมอ

## Consequences
- **Positive:** เจ้าหน้าที่ทำงานภาคสนามได้ต่อเนื่อง 100% แม้ไม่มีสัญญาณอินเทอร์เน็ต และออกบิลกระดาษความร้อนให้ลูกบ้านได้ทันทีหน้างาน
- **Negative:** ต้องรักษาความสอดคล้องของสูตรคำนวณค่าน้ำระหว่าง Go Backend และ TypeScript Frontend ด้วย Unit Tests ชุดเดียวกัน
- **Constraints (สำหรับ AI Agent):**
  - ทุกการส่งข้อมูลจดมิเตอร์จาก Offline Queue ต้องแนบ `client_reading_id` เสมอเพื่อป้องกันข้อมูลซ้ำ
  - ระบบ OCR ต้องเป็นตัวช่วยกรอก (Assisted Input) ห้ามบันทึกบิลอัตโนมัติโดยไม่ผ่านการยืนยันหรืออนุญาตให้เจ้าหน้าที่แก้ไขตัวเลขได้
