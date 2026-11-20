# Architecture Decision Records (ADRs)

ไดเรกทอรีนี้เก็บรวบรวม Architecture Decision Records (ADRs) สำหรับโปรเจกต์ Water Smart Bill โดยทุกการเปลี่ยนแปลงเชิงสถาปัตยกรรม เทคโนโลยี และการจัดการข้อมูลจะต้องถูกบันทึกไว้ที่นี่เสมอ

## Index of Decisions

| ADR | Title | Date | Status |
| :---: | :--- | :---: | :---: |
| [0001](0001-superpowers-framework-and-git-workflow.md) | มาตรฐานการใช้งาน Superpowers Framework และ Full Autonomous Git Workflow | 2026-11-18 | **Accepted** |
| [0002](0002-water-smart-bill-system-architecture.md) | สถาปัตยกรรมระบบบริหารจัดการน้ำประปา อบต. (Water Smart Bill System Architecture) | 2026-11-18 | **Accepted** |
| [0003](0003-offline-first-sync-bluetooth-escpos-and-hybrid-ocr.md) | ระบบ Offline-First Sync, เครื่องพิมพ์ใบเสร็จ Bluetooth (ESC/POS) และ Hybrid OCR อ่านเลขมิเตอร์ | 2026-11-18 | **Accepted** |
| [0004](0004-keycloak-oidc-redis-jwt-blacklist-and-tailwind-theme.md) | ระบบยืนยันตัวตน Keycloak OIDC, Redis JWT Blacklist เมื่อ Logout และ Custom Tailwind CSS Login Theme | 2026-11-18 | **Accepted** |
| [0005](0005-frontend-vertical-slice-and-backend-hexagonal-architecture.md) | โครงสร้าง Frontend แบบ Vertical Slice Architecture (`piliar.me`) และ Backend แบบ Hexagonal Architecture (`vinisantos.dev`) | 2026-11-18 | **Accepted** |
| [0006](0006-finance-cashier-invoicing-receipts-and-csv-export.md) | ระบบรับชำระเงินค่าน้ำที่สำนักงาน อบต. ออกใบเสร็จรับเงิน และส่งออกรายงานการจัดเก็บ (CSV Export) | 2026-11-18 | **Accepted** |
| [0007](0007-hyperframes-and-elevenlabs-thai-video-tutorial.md) | การสร้างวิดีโอสอนใช้งานระบบอัตโนมัติด้วย HeyGen HyperFrames และพากย์เสียงภาษาไทยด้วย ElevenLabs TTS | 2026-11-18 | **Accepted** |
| [0008](0008-integrate-claude-bughunter-security-framework.md) | การผสานรวม Claude-BugHunter Security Framework เข้ากับวงจรการพัฒนา Superpowers | 2026-11-18 | **Accepted** |

---

## Standard ADR Template (บังคับใช้ทุกครั้ง)

แม่แบบมาตรฐานถูกจัดเก็บไว้ที่ไฟล์ 👉 [template.md](template.md)  
**ข้อบังคับสำหรับ AI Agent และผู้พัฒนา:** ก่อนทำการเขียน ADR ฉบับใหม่ทุกครั้ง จะต้องอ่าน Pattern จากไฟล์ `template.md` ก่อนเสมอ และต้องมีหัวข้อ `Constraints (สำหรับ AI Agent)` ครบถ้วนทุกฉบับ
