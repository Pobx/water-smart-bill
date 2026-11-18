# Water Smart Bill — Approved System Design Specification

- **Date:** 2026-11-18
- **Status:** Approved by User
- **Related ADRs:** [ADR 0002](../../adr/0002-water-smart-bill-system-architecture.md), [ADR 0003](../../adr/0003-offline-first-sync-bluetooth-escpos-and-hybrid-ocr.md), [ADR 0004](../../adr/0004-keycloak-oidc-redis-jwt-blacklist-and-tailwind-theme.md)
- **Related Documents:** [PRD.md](../../PRD.md), [SRS.md](../../SRS.md), [schema.md](../../database/schema.md)

---

## 1. Approved Architecture Decisions
1. **System Architecture**: Modular Clean/Hexagonal Architecture (`backend-go` with Echo v4 + PostgreSQL 16 + Redis 7, and `frontend-react` with React 18 + TypeScript + Vite + Tailwind CSS + `shadcn/ui` & `v0.app` style).
2. **JWT Blacklist on Logout**: Redis 7 (`redis:7-alpine`) in Docker Compose storing revoked `jti` / token digest with TTL matching the remaining token lifetime, enforced on every authenticated request via Echo middleware.
3. **Keycloak Customized Login**: Custom Keycloak Login Theme styled with Tailwind CSS (`deploy/keycloak/themes/water-smart-bill/login/`).
4. **Offline-First Meter Reading & Sync**: IndexedDB / LocalStorage offline store with pre-synced meter routes and tariff tiers, client-side progressive water bill calculation, and idempotent batch synchronization (`client_reading_id`).
5. **Bluetooth Receipt Printing**: Web Bluetooth API (`navigator.bluetooth`) generating ESC/POS 58mm/80mm byte streams for portable thermal printers, plus browser thermal receipt print fallback.
6. **Hybrid Meter OCR**: Supports both client-side offline OCR/digit recognition and backend OCR/Vision endpoint (`POST /api/v1/tabwater/ocr/meter-read`) with manual confirmation.
7. **Avatar & Meter Photo Storage**: Local Volume mounted in Backend Container (`/data/uploads`) with automatic SVG Default Avatar fallback (`/api/v1/avatars/default`) when a homeowner has no uploaded photo.
8. **LINE LIFF Resident Portal**: Dedicated resident view (`/liff`) and API (`/api/v1/liff/*`) allowing homeowners to link their LINE account and inspect water usage, meter reading photos, unpaid bills, PromptPay QR, and receipts.
9. **Swagger Non-Prod Gate**: OpenAPI 3.0 spec and Swagger UI (`/swagger/*`) enabled strictly when `APP_ENV != "production"`.
