# ADR 0006: Finance & Cashier Invoicing, Receipts and CSV Export

## Status
Accepted (วันที่ 2026-11-18)

## Context
ในการดำเนินงานขององค์การบริหารส่วนตำบล (อบต.) นอกจากการให้เจ้าหน้าที่ภาคสนามจดมิเตอร์น้ำและพิมพ์บิลหน้างานแล้ว ยังมีกรณีที่เจ้าของบ้านหรือผู้ใช้น้ำเดินทางมาชำระค่าน้ำที่สำนักงาน อบต. ณ โต๊ะการเงิน (Cashier Desk) เจ้าหน้าที่การเงิน (`finance_staff` / `admin`) จำเป็นต้องสามารถ:
1. ค้นหาใบแจ้งหนี้ค่าน้ำของลูกบ้านได้อย่างรวดเร็วตามบ้านเลขที่, ชื่อเจ้าของบ้าน หรือเลขที่บิล
2. รับชำระเงินค่าน้ำ (เงินสด หรือโอนผ่าน QR PromptPay) และเปลี่ยนสถานะบิลเป็น `paid`
3. ออกใบเสร็จรับเงินอย่างเป็นทางการพร้อมเลขที่ใบเสร็จ (`RC-YYYYMM-XXXX`) และสั่งพิมพ์ผ่านเครื่องพิมพ์ใบเสร็จความร้อน (Bluetooth ESC/POS 58mm/80mm) หรือพิมพ์ผ่านเบราว์เซอร์
4. ดูยอดสรุปการจัดเก็บรายได้ประจำวัน/ประจำงวด (จำนวนบิล, หน่วยน้ำรวม, ค่าน้ำรวม, ค่ารักษามิเตอร์, VAT, ยอดรวมสุทธิ, สัดส่วนเงินสด vs QR) และส่งออกรายงานเป็นไฟล์ `.csv` สำหรับกระทบยอดทางบัญชี

## Decision
1. **Frontend Vertical Slice Architecture:**
   - สร้าง Slice ใหม่ `frontend-react/src/features/finance-cashier/` ประกอบด้วย `FinanceCashierScreen.tsx`, `useFinanceCashier.ts`, `financeCashierApi.ts` และ `index.ts`
   - เพิ่มเมนูนำทาง "การเงินและรับชำระ (Finance & Cashier)" ใน `App.tsx` เพื่อให้เจ้าหน้าที่การเงินเข้าใช้งานได้โดยตรง
2. **Backend Hexagonal Architecture:**
   - เพิ่ม Domain Model `CollectionSummaryReport` และ `CollectionReportFilter` ใน `backend-go/application/water_bill.go`
   - เพิ่ม Port ใน `application/ports/water_bill_services_port.go`: `GetCollectionReport(...)` และ `ExportCollectionReportCSV(...)`
   - พัฒนา Go Service ใน `application/services/water_bill_service.go` โดยใช้ standard library `encoding/csv` ในการจัดทำสตรีมข้อมูล CSV เพื่อประสิทธิภาพและความปลอดภัย
   - เพิ่ม REST Endpoint ใน `adapters/web/rest/handler/water_bill_rest.go`: `GET /api/v1/water-bills/reports/collections` พร้อมรองรับ parameter `format=csv` หรือ HTTP Header `Accept: text/csv`

## Consequences
- **Positive:**
  - รองรับขั้นตอนการทำงานของฝ่ายการเงิน อบต. ได้ครบวงจร (Counter Service at SAO)
  - การส่งออก CSV เกิดขึ้นที่ Backend ทำให้มีความรวดเร็ว ไม่กินหน่วยความจำของฝั่งเบราว์เซอร์ และสามารถนำไปทำ Automated Export หรือ Batch Reporting ในอนาคตได้
  - ปฏิบัติตามมาตรฐาน Hexagonal Architecture และ Vertical Slice Architecture อย่างเคร่งครัด
- **Negative:**
  - ต้องเพิ่มเส้นทาง Endpoint และโมเดลข้อมูลรายงานใน Backend
- **Constraints (สำหรับ AI Agent):**
  - โค้ดฝั่ง React ของโมดูลการเงินต้องอยู่ภายใต้ `features/finance-cashier/` เท่านั้น ห้ามกระจาย Logic ออกไปปนกับโมดูลอื่น
  - โค้ดฝั่ง Go ต้องเคารพ Port & Adapter separation โดย Logic การสรุปยอดและ CSV writer ต้องอยู่ใน Service Layer
