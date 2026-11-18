# ADR 0007: การสร้างวิดีโอสอนใช้งานระบบอัตโนมัติด้วย HeyGen HyperFrames และพากย์เสียงภาษาไทยด้วย ElevenLabs TTS

## Status
Accepted (วันที่ 2026-11-18)

## Context
ระบบ Water Smart Bill มีฟีเจอร์ครอบคลุมการบริหารจัดการน้ำประปาขององค์กรปกครองส่วนท้องถิ่น (อบต.) ทั้งหมด 5 โมดูลหลัก (Master Data & Default Avatar, Progressive Tariffs & Water Meters, Offline-First Field Meter Reader + AI OCR + Bluetooth ESC/POS, Finance & Cashier Desk, และ LINE LIFF Resident Portal) รวมถึงระบบความปลอดภัย Keycloak OIDC + JWT Blacklist เพื่อให้เจ้าหน้าที่ อบต. และผู้ใช้งานสามารถเรียนรู้วิธีการใช้งานได้รวดเร็วและเข้าใจง่าย จึงต้องการระบบผลิตวิดีโอสอนใช้งาน (Tutorial Video) ความละเอียด Full HD (1920×1080 @ 30fps) ที่มีเสียงพากย์ภาษาไทยเป็นธรรมชาติ ซิงค์เวลากับแอนิเมชันชี้จุดสำคัญบนหน้าจอจริง และสามารถแก้ไขด้วยโค้ดได้แบบ Deterministic

## Decision
1. **ใช้สถาปัตยกรรม Audio-First Multi-Scene Composition (HyperFrames + ElevenLabs):**
   - แบ่งวิดีโอออกเป็น 7 ฉาก (`scene_01` ถึง `scene_07`) ครอบคลุม Intro/Security, 5 ฟีเจอร์หลัก และ Outro
   - เก็บบทพากย์ภาษาไทย (พร้อมคำอ่านทับศัพท์ภาษาไทยเพื่อการออกเสียงที่แม่นยำ) และข้อความซับไตเติลไว้ใน `video-tutorial/script_th.json`
2. **ระบบสังเคราะห์เสียงพากย์ภาษาไทย (ElevenLabs TTS + Offline Fallback):**
   - ใช้โมเดล `eleven_multilingual_v2` ของ ElevenLabs API (`POST https://api.elevenlabs.io/v1/text-to-speech/{voice_id}`) โดยรับค่า `ELEVENLABS_API_KEY` จาก Environment Variable เท่านั้น
   - หากสภาพแวดล้อมไม่สามารถเชื่อมต่อเครือข่ายภายนอกชั่วคราวหรือคีย์หมดโควตา ระบบมีกลไก Fallback สร้างเสียงพากย์ภาษาไทย/เสียงบรรยายมาตรฐานเพื่อให้ Pipeline ทำงานต่อได้แบบไม่สะดุด (Zero-Downtime Deterministic Pipeline)
   - ใช้ `ffprobe` วัดความยาวเสียงจริง (`durationSeconds`) ของแต่ละฉากและบันทึกใน `video-tutorial/assets/audio/manifest.json`
3. **ระบบเรนเดอร์วิดีโอจาก HTML/CSS/GSAP (HyperFrames Format):**
   - สร้าง Composition มาตรฐาน HyperFrames ใน `video-tutorial/index.html` และ `video-tutorial/compositions/scene_01..07.html` ที่ระบุ `data-composition`, `data-width="1920"`, `data-height="1080"`, `data-fps="30"`, และ `data-duration` ตามความยาวเสียงจริง
   - ใช้ภาพหน้าจอจริง (`screenshot_01` ถึง `screenshot_05`) ร่วมกับแอนิเมชัน Spotlight Zoom, Callout Badges, Animated Cursor และซับไตเติลภาษาไทยด้วยฟอนต์ `Kanit` และ `Sarabun`
   - เรนเดอร์แต่ละเฟรมแบบ Deterministic ผ่าน Headless Chromium และเข้ารหัสวิดีโอ H.264 + AAC MP4 (`water_smart_bill_tutorial_th.mp4`) ด้วย FFmpeg

## Consequences
- **Positive:**
  - ได้วิดีโอสอนใช้งานระบบความละเอียด Full HD 1080p ที่เสียงพากย์ภาษาไทยและภาพแอนิเมชันซิงค์ตรงกัน 100% ทุกฉาก
  - แก้ไขข้อความ คำบรรยาย หรือเปลี่ยนภาพหน้าจอเฉพาะฉากได้ง่ายด้วย HTML/CSS แล้วสั่งเรนเดอร์ใหม่ได้ทันทีโดยไม่ต้องใช้โปรแกรมตัดต่อวิดีโอ
  - มีชุดทดสอบอัตโนมัติตรวจสอบความถูกต้องของสคริปต์ 7 ฉาก, ไฟล์เสียง และไฟล์ MP4
- **Negative:**
  - การเรนเดอร์วิดีโอความละเอียด 1920×1080 ผ่าน Headless Browser ต้องใช้เวลาประมวลผลเฟรมและพื้นที่จัดเก็บไฟล์เสียง/วิดีโอ
- **Constraints (สำหรับ AI Agent):**
  - **ห้าม** ハาร์ดโค้ด (Hardcode) หรือ Commit ค่า `ELEVENLABS_API_KEY` ลงใน Git Repository หรือไฟล์โค้ดโดยเด็ดขาด ต้องอ่านจาก `process.env.ELEVENLABS_API_KEY` เท่านั้น
  - ความยาวของแต่ละฉาก (`data-duration`) ต้องอ้างอิงจากความยาวไฟล์เสียงที่วัดด้วย `ffprobe` เสมอ ห้ามใช้เวลาคงที่ที่ทำให้เสียงพากย์ถูกตัดขาด
  - ฟอนต์ภาษาไทย (`Kanit` / `Sarabun`) ต้องถูกโหลดในหน้า HTML ของ HyperFrames เสมอเพื่อป้องกันปัญหาสระลอยหรือตัวอักษรเป็นสี่เหลี่ยม (Tofu)
