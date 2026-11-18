# ADR 0001: มาตรฐานการใช้งาน Superpowers Framework และ Full Autonomous Git Workflow

## Status
Accepted (วันที่ 2026-11-18)

## Context
โปรเจกต์ `water-smart-bill` ต้องการวางโครงสร้างการทำงานร่วมกับ AI Agent ให้เป็นไปตามมาตรฐานเดียวกับทุก repository ใน workspace เพื่อให้กระบวนการพัฒนา วางแผน ทดสอบ และส่งมอบงานมีคุณภาพและตรวจสอบได้ตามขั้นตอนที่เป็นระบบ

## Decision
1. **Superpowers Methodology**: บังคับใช้กรอบการทำงานของ Superpowers (`using-superpowers`) ครบทุกขั้นตอน ตั้งแต่วิเคราะห์โจทย์ (`brainstorming`), แตกแผนงาน (`writing-plans`), พัฒนาแบบ TDD (`test-driven-development`), ตรวจสอบสาเหตุปัญหา (`systematic-debugging`), และยืนยันผลด้วยหลักฐานก่อนส่งงาน (`verification-before-completion`)
2. **Full Autonomous Git Workflow**: Agent สร้าง Branch ใหม่จาก `main`, ทำการพัฒนา, รัน Verification Command ตรวจสอบ, Commit แบบ Conventional Commit, Push Branch, Merge เข้า `main`, และ Push `main` ขึ้น Remote Origin โดยอัตโนมัติ
3. **ADR Governance**: บันทึกการตัดสินใจสถาปัตยกรรมทุกครั้งลงใน `docs/adr/` โดยยึดตาม `template.md`

## Consequences
- **Positive:** กระบวนการทำงานมีระเบียบ ชัดเจน ไม่เกิดข้อผิดพลาดจากการแก้โค้ดโดยไม่มี Test หรือแผนรองรับ
- **Negative:** มีขั้นตอนกระบวนการเพิ่มขึ้น ต้องมีเอกสารและการยืนยันตาม Gate
- **Constraints (สำหรับ AI Agent):**
  - ห้ามเขียนโค้ดฟีเจอร์ใหม่โดยไม่ผ่านกระบวนการ `brainstorming` และ `writing-plans`
  - ห้าม Commit ลง Branch `main` โดยตรง ต้องสร้าง Branch แยกเสมอ
  - ทุกการเปลี่ยนแปลงเชิงสถาปัตยกรรมต้องอัปเดต ADR
