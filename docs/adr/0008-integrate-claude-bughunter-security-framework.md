# ADR 0008: การผสานรวม Claude-BugHunter Security Framework เข้ากับวงจรการพัฒนา Superpowers

## Status
Accepted (วันที่ 2026-11-18)

## Context
โปรเจกต์ `water-smart-bill` เป็นระบบบริหารจัดการน้ำประปาสำหรับ อบต. แบบ Multi-Tenant ที่มีการยืนยันตัวตนด้วย Keycloak OIDC + JWT Blacklist, การแยกข้อมูลระดับองค์กรด้วย PostgreSQL Row-Level Security (RLS), การซิงค์ข้อมูลมิเตอร์แบบ Offline-First, การรับชำระเงินและออกใบเสร็จรับเงิน รวมถึงการเชื่อมต่อ LINE LIFF สำหรับประชาชน จึงจำเป็นต้องมีกรอบการตรวจสอบช่องโหว่และความปลอดภัยเชิงรุก (Offensive Security & Vulnerability Hunting) ที่เป็นมาตรฐานเดียวกับทุกโปรเจกต์ใน workspace

## Decision
1. **Adopt Claude-BugHunter (`elementalsouls/Claude-BugHunter`):** ผสานรวมชุดทักษะ 83 skills ของ Claude-BugHunter เข้าเป็นขั้นตอนที่ 8 ในวงจรการพัฒนาควบคู่กับ `Superpowers`
2. **Modular Security Rule (`.agents/rules/security-bughunter.md`):** กำหนดให้ AI Agent ต้องเรียกใช้ทักษะ `hunt-*` ที่ตรงกับโมดูล (`hunt-jwt`, `hunt-oauth`, `hunt-auth-bypass`, `hunt-idor`, `hunt-sqli`, `hunt-business-logic`, `hunt-race-condition`, `hunt-file-upload`, `hunt-xss`, `triage-validation`, `evidence-hygiene`) ก่อนจบงานทุกครั้ง
3. **7-Question Validation Gate & Evidence Hygiene:** บังคับตรวจสอบการแบ่งแยกข้อมูลระหว่าง อบต. (`org_id` / RLS), ความถูกต้องของการเพิกถอน JWT (`jti` blacklist), ความถูกต้องของการคำนวณค่าน้ำ/ใบเสร็จ และห้ามมี API Key หรือข้อมูลส่วนบุคคลรั่วไหลใน Git

## Consequences
- **Positive:** ป้องกันช่องโหว่ข้ามหน่วยงาน อบต. (Cross-Tenant IDOR), JWT Replay หลัง Logout, Business Logic Bypass ในการคำนวณค่าน้ำและการรับชำระเงินซ้ำซ้อน
- **Negative:** มีขั้นตอนการตรวจสอบด้านความปลอดภัยเพิ่มเติมก่อนการส่งมอบงาน
- **Constraints (สำหรับ AI Agent):**
  - ห้ามแก้ไขระบบ Auth, Multi-Tenant Queries, การซิงค์ Offline หรือระบบรับชำระเงิน โดยไม่ตรวจสอบตาม `Claude-BugHunter Attack-Surface Mapping` ใน `AGENTS.md`
  - ห้ามบันทึกหรือ commit ค่า Keycloak Secret, ElevenLabs API Key หรือ JWT Token จริงลงใน Git (`evidence-hygiene`)
