# Frontend Vertical Slice & Backend Hexagonal Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:test-driven-development` and `superpowers:verification-before-completion` to execute this plan task-by-task.

**Goal:** Align `frontend-react/` with Vertical Slice Architecture ([piliar.me](https://www.piliar.me/blog/vertical-slice-architecture-react-native/)) and `backend-go/` with Hexagonal Architecture ([vinisantos.dev](https://vinisantos.dev/posts/hexagonal-architecture-with-golang)).

**Architecture:**
- **Backend (`backend-go/`):** Separate `application/` (domain entities + `IsValid() (bool, error)`, `application/ports/` for `WaterBillRepositoryInterface`, `WaterBillServiceInterface`, `TokenVerifierInterface`, `TokenBlacklistInterface`, and `application/services/` for `WaterBillService`) from `adapters/` (`adapters/dto/` with `Bind()` & `ConvertToEntity()`, `adapters/web/rest/handler/`, `adapters/web/rest/server.go`, `adapters/sqldb/`, `adapters/memory/`, `adapters/keycloak/`, `adapters/blacklist/`).
- **Frontend (`frontend-react/`):** Organize business features into vertical slices under `src/features/<slice>/` (`master-data`, `tariffs-meters`, `field-reader`, `liff-portal`, `auth`), each with `<Feature>Screen.tsx` (or `<Feature>Modal.tsx`), `use<Feature>.ts`, `<feature>Api.ts`, and barrel `index.ts`.

---

### Task 1: Backend Hexagonal Architecture (`application/` & `adapters/`)
- **Files:**
  - `backend-go/application/tabwater.go` & `backend-go/application/domain.go` & `backend-go/application/domain_test.go`
  - `backend-go/application/ports/tabwater_persistence.go` & `backend-go/application/ports/tabwater_services_port.go`
  - `backend-go/application/services/tabwater_service.go` & `backend-go/application/services/tabwater_service_test.go`
  - `backend-go/adapters/dto/tabwater_dto.go` & `backend-go/adapters/dto/tabwater_dto_test.go`
  - `backend-go/adapters/web/rest/handler/tabwater_rest.go` & `backend-go/adapters/web/rest/server.go` & `backend-go/adapters/web/rest/server_test.go`
  - `backend-go/adapters/sqldb/repository.go`, `backend-go/adapters/memory/repository.go`, `backend-go/adapters/keycloak/verifier.go`, `backend-go/adapters/blacklist/redis_blacklist.go`
  - `backend-go/cmd/api/main.go`
- **Verification:** `cd backend-go && go test ./... -v`

### Task 2: Frontend Vertical Slice Architecture (`src/features/<slice>/`)
- **Files:**
  - `frontend-react/src/shared/api/httpClient.ts` & `frontend-react/src/shared/types/waterSmartBill.ts`
  - `frontend-react/src/features/auth/` (`AuthModal.tsx`, `useAuth.ts`, `authApi.ts`, `index.ts`)
  - `frontend-react/src/features/master-data/` (`MasterDataScreen.tsx`, `useMasterData.ts`, `masterDataApi.ts`, `index.ts`)
  - `frontend-react/src/features/tariffs-meters/` (`TariffsMetersScreen.tsx`, `useTariffsMeters.ts`, `tariffsMetersApi.ts`, `index.ts`)
  - `frontend-react/src/features/field-reader/` (`FieldReaderScreen.tsx`, `useFieldReader.ts`, `fieldReaderApi.ts`, `index.ts`)
  - `frontend-react/src/features/liff-portal/` (`LiffPortalScreen.tsx`, `useLiffPortal.ts`, `liffPortalApi.ts`, `index.ts`)
  - `frontend-react/src/app/App.tsx`
  - `frontend-react/src/e2e/verticalSlices.test.tsx` & `frontend-react/src/e2e/app.test.tsx`
- **Verification:** `cd frontend-react && npm test && npm run build`
