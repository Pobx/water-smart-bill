# Water Smart Bill — Approved System Design Specification

- **Date:** 2026-11-18
- **Status:** Approved by User
- **Related ADRs:** [ADR 0002](../../adr/0002-water-smart-bill-system-architecture.md), [ADR 0003](../../adr/0003-offline-first-sync-bluetooth-escpos-and-hybrid-ocr.md), [ADR 0004](../../adr/0004-keycloak-oidc-redis-jwt-blacklist-and-tailwind-theme.md), [ADR 0005](../../adr/0005-frontend-vertical-slice-and-backend-hexagonal-architecture.md)
- **Related Documents:** [PRD.md](../../PRD.md), [SRS.md](../../SRS.md), [schema.md](../../database/schema.md)

---

## 1. Approved Architecture Decisions
1. **Frontend Vertical Slice Architecture (`piliar.me`)**: `frontend-react/src/features/<slice>/` owns `<Feature>Screen.tsx`, `use<Feature>.ts`, `<feature>Api.ts`, and barrel `index.ts` for each business slice (`master-data`, `tariffs-meters`, `field-reader`, `liff-portal`, `auth`), while `src/shared/` contains strictly cross-feature utilities and `src/app/App.tsx` acts as the navigation shell.
2. **Backend Hexagonal Architecture (`vinisantos.dev`)**: `backend-go/application/` contains pure domain entities (`IsValid()`), `application/ports/` (`WaterBillRepositoryInterface`, `WaterBillServiceInterface`, `TokenVerifierInterface`, `TokenBlacklistInterface`), and `application/services/` (`WaterBillService`), while `backend-go/adapters/` contains `adapters/dto/` (`Bind` & `ConvertToEntity`), `adapters/web/rest/handler/`, `adapters/web/rest/server.go`, `adapters/sqldb/`, `adapters/memory/`, `adapters/keycloak/`, and `adapters/blacklist/`.
3. **JWT Blacklist on Logout**: Redis 7 (`redis:7-alpine`) in Docker Compose storing revoked `jti` / token digest with TTL matching the remaining token lifetime, enforced on every authenticated request via Echo middleware.
4. **Keycloak Customized Login**: Custom Keycloak Login Theme styled with Tailwind CSS (`deploy/keycloak/themes/water-smart-bill/login/`).
5. **Offline-First Meter Reading & Sync**: IndexedDB / LocalStorage offline store with pre-synced meter routes and tariff tiers, client-side progressive water bill calculation, and idempotent batch synchronization (`client_reading_id`).
6. **Bluetooth Receipt Printing**: Web Bluetooth API (`navigator.bluetooth`) generating ESC/POS 58mm/80mm byte streams for portable thermal printers, plus browser thermal receipt print fallback.
7. **Hybrid Meter OCR**: Supports both client-side offline OCR/digit recognition and backend OCR/Vision endpoint (`POST /api/v1/tabwater/ocr/meter-read`) with manual confirmation.
8. **Avatar & Meter Photo Storage**: Local Volume mounted in Backend Container (`/data/uploads`) with automatic SVG Default Avatar fallback (`/api/v1/avatars/default`) when a homeowner has no uploaded photo.
9. **LINE LIFF Resident Portal**: Dedicated resident view (`/liff`) and API (`/api/v1/liff/*`) allowing homeowners to link their LINE account and inspect water usage, meter reading photos, unpaid bills, PromptPay QR, and receipts.
10. **Swagger Non-Prod Gate**: OpenAPI 3.0 spec and Swagger UI (`/swagger/*`) enabled strictly when `APP_ENV != "production"`.
