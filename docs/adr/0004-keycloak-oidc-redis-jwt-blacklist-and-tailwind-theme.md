# ADR 0004: ระบบยืนยันตัวตน Keycloak OIDC, Redis JWT Blacklist เมื่อ Logout และ Custom Tailwind CSS Login Theme

## Status
Accepted (วันที่ 2026-11-18)

## Context
ระบบต้องการความปลอดภัยระดับองค์กรโดยใช้ Keycloak เป็น Authentication Server ร่วมกับข้อกำหนดเฉพาะดังนี้:
1. เมื่อผู้ใช้งานกด Logout ต้องทำการ Blacklist JWT Access Token ทันที เพื่อไม่ให้ Token ที่ยังไม่หมดอายุถูกนำกลับมาเรียก API ได้อีก
2. หน้า Login ของ Keycloak ต้องถูกปรับแต่ง (Customize) ด้วย Tailwind CSS ให้มีดีไซน์สอดคล้องกับ `shadcn/ui` และ `v0.app`
3. เจ้าของบ้านสามารถเข้าดูข้อมูลการใช้น้ำและประวัติการชำระเงินผ่าน LINE LIFF ได้อย่างปลอดภัย

## Decision
1. **Keycloak OIDC + Custom Tailwind CSS Login Theme**:
   - ใช้ Keycloak 26 (`realm: water-smart-bill`) ด้วย Authorization Code Flow + PKCE
   - สร้าง Custom Login Theme (`deploy/keycloak/themes/water-smart-bill/login/`) ที่ออกแบบด้วย Tailwind CSS โทนสี `shadcn/ui` (Slate & Sky Blue)
2. **Redis JWT Blacklist on Logout**:
   - ใช้ Redis (`redis:7-alpine`) เก็บรายการ `jti` (JWT ID) หรือ SHA-256 Token Digest ที่ถูก Logout (`blacklist:jwt:<jti>`) พร้อมกำหนด TTL เท่ากับเวลาที่เหลือของ Token (`exp - now`)
   - เมื่อเรียก `POST /api/v1/auth/logout` ระบบจะบันทึก Token ลง Redis Blacklist ทันที และ Middleware ของ Go Echo จะตรวจสอบทั้งลายเซ็น RS256 (JWKS) และตรวจว่าไม่อยู่ใน Redis Blacklist ก่อนอนุญาตให้เข้าถึง API
3. **LINE LIFF Resident Portal Integration**:
   - แยกเส้นทาง `/api/v1/liff/*` และหน้าเว็บ `/liff` สำหรับเจ้าของบ้าน โดยอ้างอิง `line_user_id` หรือเลขมิเตอร์คู่กับบ้านเลขที่เพื่อดูข้อมูลค่าน้ำและใบเสร็จเฉพาะของตนเอง

## Consequences
- **Positive:** ปิดช่องโหว่การนำ Stateless JWT ที่ยังไม่หมดอายุมาใช้งานซ้ำหลัง Logout ได้ 100% ด้วยความเร็วระดับ Sub-millisecond จาก Redis
- **Negative:** เพิ่ม Redis Container เข้ามาในชุด `docker-compose.yml`
- **Constraints (สำหรับ AI Agent):**
  - ทุก Protected Route ใน Go Echo ต้องผ่าน Middleware ที่เช็คทั้ง JWKS Signature และ Redis JWT Blacklist เสมอ
  - ห้ามเปิดเผยข้อมูลของลูกบ้านรายอื่นผ่าน LINE LIFF API โดยเด็ดขาด
