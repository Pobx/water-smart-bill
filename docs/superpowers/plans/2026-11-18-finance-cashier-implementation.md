# Implementation Plan: Finance & Cashier Module

- **Date:** 2026-11-18
- **Branch:** `feat/finance-cashier-module`
- **Specification:** `docs/superpowers/specs/2026-11-18-water-smart-bill-design.md` & `finance_cashier_design_doc.md`
- **Methodology:** Superpowers Test-Driven Development (TDD) + Hexagonal Backend + Vertical Slice Frontend

---

## Task Breakdown

### Task 1: Architecture Decision Record (ADR 0006)
- **Files to create/modify:**
  - `docs/adr/0006-finance-cashier-invoicing-receipts-and-csv-export.md`
  - `docs/adr/README.md`
- **Verification:** Verify ADR adheres to `docs/adr/template.md` and index table is updated.

### Task 2: Backend Domain & Port Extension (TDD Red -> Green)
- **Files to modify:**
  - `backend-go/application/water_bill.go` (Add `CollectionReportFilter`, `CollectionSummaryReport`)
  - `backend-go/application/ports/water_bill_services_port.go` (Add `GetCollectionReport`, `ExportCollectionReportCSV`)
  - `backend-go/application/services/water_bill_service.go` (Implement report aggregation & CSV generation)
  - `backend-go/application/services/water_bill_service_test.go` (Add `TestGetCollectionReportAndCSVExport`)
- **Verification:** `go test -C backend-go -v ./application/services/...` passes.

### Task 3: Backend REST Handler & Swagger Update (TDD Red -> Green)
- **Files to modify:**
  - `backend-go/adapters/web/rest/handler/water_bill_rest.go` (Add `GetCollectionReport` handler with CSV/JSON response)
  - `backend-go/adapters/web/rest/server.go` (Register `/api/v1/water-bills/reports/collections`)
  - `backend-go/adapters/web/rest/server_test.go` (Add tests for report endpoint JSON and CSV output)
- **Verification:** `go test -C backend-go -v ./adapters/web/rest/...` passes.

### Task 4: Frontend Vertical Slice `finance-cashier` (TDD Red -> Green)
- **Files to create:**
  - `frontend-react/src/features/finance-cashier/financeCashierApi.ts`
  - `frontend-react/src/features/finance-cashier/useFinanceCashier.ts`
  - `frontend-react/src/features/finance-cashier/FinanceCashierScreen.tsx`
  - `frontend-react/src/features/finance-cashier/index.ts`
  - `frontend-react/src/features/finance-cashier/financeCashier.test.ts`
- **Verification:** `npm --prefix frontend-react test` passes.

### Task 5: App Integration & Navigation
- **Files to modify:**
  - `frontend-react/src/app/App.tsx` (Add Finance & Cashier navigation tab and screen rendering)
  - `frontend-react/src/e2e/verticalSlices.test.tsx` (Add assertion for Finance & Cashier slice)
- **Verification:** `npm --prefix frontend-react test` passes and `npm --prefix frontend-react run build` succeeds.

### Task 6: Full Verification, Git Commit, Push & Merge
- **Actions:**
  - Run `go test -C backend-go -v ./...`
  - Run `npm --prefix frontend-react test -- --run`
  - Run `npm --prefix frontend-react run build`
  - Autonomous Git commit, merge into `main`, and push to `origin/main`
