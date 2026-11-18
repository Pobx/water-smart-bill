# ADR 0005: โครงสร้าง Frontend แบบ Vertical Slice Architecture (`piliar.me`) และ Backend แบบ Hexagonal Architecture (`vinisantos.dev`)

## Status
Accepted (วันที่ 2026-11-18)

## Context
หลังจากออกแบบและพัฒนาระบบ **Water Smart Bill** ในเฟสแรก ทางทีมสถาปนิกต้องการกำหนดมาตรฐานการจัดวางโครงสร้างโฟลเดอร์และชั้นของโค้ด (Codebase & Package Architecture) ให้สอดคล้องกับแนวปฏิบัติอ้างอิงทั้งฝั่ง Frontend และ Backend อย่างเคร่งครัด เพื่อป้องกันปัญหาโค้ดกระจัดกระจายตามชนิดไฟล์ (Horizontal Technical Layers) ในฝั่ง Frontend และป้องกันการผูกติดระหว่าง Domain Logic กับ HTTP/Database Adapter ในฝั่ง Backend:
1. **Frontend Reference:** [Structure Your React Native App Like a Pro: Vertical Slice Architecture Guide (piliar.me)](https://www.piliar.me/blog/vertical-slice-architecture-react-native/)
2. **Backend Reference:** [Hexagonal Architecture with Golang (vinisantos.dev)](https://vinisantos.dev/posts/hexagonal-architecture-with-golang)

## Decision
### 1. Frontend (`frontend-react/`): Vertical Slice Architecture ตามแนวทาง `piliar.me`
- จัดโครงสร้างตาม **Feature Slice** ภายใต้ `src/features/<feature-name>/` แทนการรวมโค้ดทุกหน้าไว้ในไฟล์เดียวหรือแยกตามชนิดเทคนิค (`screens/`, `hooks/`, `api/` ระดับบนสุด)
- แต่ละ Feature Slice ต้องเป็นโมดูลที่สมบูรณ์ในตัวเอง (Self-Contained Slice) ประกอบด้วย:
  - `<Feature>Screen.tsx`: คอมโพเนนต์หลักของฟีเจอร์ รับผิดชอบเฉพาะการแสดงผล UI (Rendering) และผูก Event เข้ากับ Custom Hook
  - `use<Feature>.ts`: Custom Hook ที่ทำหน้าที่เป็น Boundary จัดการ State, Form Validation, และ Business Logic ของฟีเจอร์นั้น
  - `<feature>Api.ts`: ฟังก์ชันเรียกใช้งาน REST API หรือแหล่งข้อมูลเฉพาะของฟีเจอร์นั้น
  - `types.ts` (หรือ Domain Utilities เฉพาะฟีเจอร์): โครงสร้างข้อมูลและตัวช่วยคำนวณภายในฟีเจอร์
  - `index.ts`: Barrel File สำหรับ Export เฉพาะ Public Interface ของฟีเจอร์ (`export { <Feature>Screen } from './<Feature>Screen'; export { use<Feature> } from './use<Feature>';`)
- แบ่ง Vertical Slices หลักของระบบ Water Smart Bill ออกเป็น:
  1. `src/features/master-data/` (`MasterDataScreen.tsx`, `useMasterData.ts`, `masterDataApi.ts`, `index.ts`) — จัดการข้อมูล อบต., ตำบล, หมู่บ้าน, บ้านเลขที่ และเจ้าของบ้านพร้อมรูป Avatar / Default Avatar
  2. `src/features/tariffs-meters/` (`TariffsMetersScreen.tsx`, `useTariffsMeters.ts`, `tariffsMetersApi.ts`, `index.ts`) — จัดการขั้นบันไดอัตราค่าน้ำ, รอบบิล และทะเบียนมิเตอร์น้ำ
  3. `src/features/field-reader/` (`FieldReaderScreen.tsx`, `useFieldReader.ts`, `fieldReaderApi.ts`, `index.ts`) — บันทึกเลขมิเตอร์หน้างาน, คำนวณค่าน้ำอัตโนมัติ, ถ่ายรูปอ่านเลขมิเตอร์ด้วย OCR, คิว Offline-First Sync และพิมพ์ใบเสร็จผ่าน Bluetooth ESC/POS
  4. `src/features/liff-portal/` (`LiffPortalScreen.tsx`, `useLiffPortal.ts`, `liffPortalApi.ts`, `index.ts`) — หน้าจอ LINE LIFF สำหรับเจ้าของบ้านตรวจสอบประวัติค่าน้ำและชำระเงินผ่าน QR PromptPay
  5. `src/features/auth/` (`AuthModal.tsx`, `useAuth.ts`, `authApi.ts`, `index.ts`) — หน้าต่างเข้าสู่ระบบ Keycloak OIDC (Custom Tailwind Login) และการออกจากระบบพร้อมเพิกถอน JWT เข้าสู่ Blacklist
- โฟลเดอร์ `src/shared/` เก็บเฉพาะโค้ดที่ใช้ร่วมกันข้ามฟีเจอร์จริง ๆ เท่านั้น (`src/shared/api/`, `src/shared/types/`, `src/shared/utils/`) ส่วน `src/app/App.tsx` ทำหน้าที่เป็น Application Shell และ Navigation เท่านั้น

### 2. Backend (`backend-go/`): Hexagonal Architecture (Ports & Adapters) ตามแนวทาง `vinisantos.dev`
- แบ่งโครงสร้างแพ็กเกจของ Go ออกเป็น 2 ชั้นหลักที่แยกออกจากกันอย่างชัดเจน คือ **`application/` (Application Core)** และ **`adapters/` (Outer Infrastructure & Delivery Layer)**:
  ```text
  backend-go/
  ├── application/                       # Core Business Layer (Zero HTTP/Echo/SQL driver dependencies)
  │   ├── tabwater.go                    # Domain Entities & Interfaces + IsValid() validation methods
  │   ├── domain.go                      # Progressive Tariff Calculator, Avatar Resolver & Core Rules
  │   ├── ports/
  │   │   ├── tabwater_persistence.go    # Outbound Ports: WaterBillRepositoryInterface, TokenVerifierInterface, TokenBlacklistInterface
  │   │   └── tabwater_services_port.go  # Inbound Service Port: WaterBillServiceInterface
  │   └── services/
  │       └── tabwater_service.go        # Service Implementation: WaterBillService (implements WaterBillServiceInterface)
  └── adapters/                          # Outer Adapters Layer (Inbound Web REST + Outbound Persistence/Auth)
      ├── dto/
      │   └── tabwater_dto.go            # Data Transfer Objects with Bind() and ConvertToEntity()
      ├── web/
      │   └── rest/
      │       ├── server.go              # Echo Server, Route Wiring, Non-Prod Swagger Gate & Auth Middleware
      │       └── handler/
      │           └── tabwater_rest.go   # Echo REST Handlers coupled strictly to ports.WaterBillServiceInterface & dto
      ├── sqldb/                         # PostgreSQL Outbound Adapter (implements ports.WaterBillRepositoryInterface)
      ├── memory/                        # In-Memory Outbound Adapter for demo/testing
      ├── keycloak/                      # Keycloak OIDC Token Verifier Outbound Adapter
      └── blacklist/                     # Redis/Memory JWT Blacklist Outbound Adapter
  ```
- **DTO & Entity Boundary (`adapters/dto`):** HTTP REST Handler ใน `adapters/web/rest/handler` ห้ามผูก JSON Payload เข้ากับโครงสร้างฐานข้อมูลโดยตรง แต่ต้องใช้ DTO (`Bind()` และ `ConvertToEntity()`) ก่อนส่งเข้าสู่ `ports.WaterBillServiceInterface`

## Consequences
- **Positive:**
  - **High Cohesion & Low Coupling ใน Frontend:** นักพัฒนาหรือ AI Agent สามารถแก้ไขฟีเจอร์ใดฟีเจอร์หนึ่ง (เช่น `field-reader` หรือ `liff-portal`) ได้ครบจบในโฟลเดอร์เดียวโดยไม่กระทบฟีเจอร์อื่น
  - **Pure Domain & Testability ใน Backend:** ชั้น `application/` และ `application/services/` สามารถเขียน Unit Test ทดสอบ Business Logic ได้ 100% โดยไม่ต้องพึ่งพา Echo HTTP Context หรือ PostgreSQL จริง
  - **Prevent Metadata Leakage:** การใช้ `adapters/dto` ที่มี `Bind()` และ `ConvertToEntity()` ป้องกันการรั่วไหลของโครงสร้างภายในออกสู่ Public REST API
- **Negative:**
  - มีจำนวนไฟล์แยกย่อยตาม Feature Slice และ DTO/Port ชัดเจนขึ้น ต้องรักษาวินัยในการ Export ผ่าน `index.ts` และ `application/ports`
- **Constraints (สำหรับ AI Agent):**
  - **Frontend Constraint:** ห้ามเขียน UI หรือ State ของฟีเจอร์ใหม่รวมไว้ใน `src/app/App.tsx` เด็ดขาด ทุกฟีเจอร์ต้องสร้างเป็น Vertical Slice ภายใต้ `src/features/<slice>/` ที่มี `<Slice>Screen.tsx`, `use<Slice>.ts`, `<slice>Api.ts` และ `index.ts` เสมอ
  - **Backend Constraint:** ห้าม import `github.com/labstack/echo/v4` หรือ `github.com/jackc/pgx/v5` เข้าไปในแพ็กเกจ `backend-go/application/...` เด็ดขาด และทุก HTTP Handler ใน `adapters/web/rest/handler` ต้องเรียกใช้งานผ่านอินเทอร์เฟซใน `application/ports` เท่านั้น
