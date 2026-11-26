# Implementation Plan: Formatted NumericInput & SearchableSelect (Option A)

**Date:** 2026-11-26  
**Branch:** `feat/numeric-input-and-searchable-select`  
**Approved Design:** Option A — `react-number-format` (`NumericFormat`) + `react-select` wrapped as reusable shared UI components in `frontend-react/src/shared/ui/`.

---

## Scope & Acceptance Criteria

1. **`NumericInput` (`frontend-react/src/shared/ui/NumericInput.tsx`)**
   - Renders plain `<input type="text" inputMode="decimal" />` (never `type="number"`).
   - Accepts only digits (`0-9`) and a single decimal point (`.`); rejects letters (`e`, `a-z`), negative signs (`-`), and symbols.
   - Automatically formats integers ≥ 4 digits with thousand separators (e.g., `1230` → `1,230`, `12345.67` → `12,345.67`).
   - Supports `0` and decimals like `0.10` accurately.
   - Prevents invalid leading zeros (`allowLeadingZeros={false}`): `01234` / `0,1234` is normalized to `1,234`.
2. **`SearchableSelect` (`frontend-react/src/shared/ui/SearchableSelect.tsx`)**
   - Built on `react-select` (`isSearchable={true}`) with Tailwind-aligned styling.
   - Supports typing Thai/English/code keywords to filter options, keyboard navigation, and accessible `aria-label` / `inputId`.
   - Displays Thai empty state (`ไม่พบรายการที่ค้นหา`).

---

## Bite-Sized Tasks (TDD RED → GREEN → REFACTOR)

- **Task 1 (2–5m):** Install `react-select` and `react-number-format` in `frontend-react/package.json`.
- **Task 2 (5m):** Write failing tests in `frontend-react/src/shared/ui/NumericInput.test.tsx`, implement `NumericInput.tsx`, and verify GREEN.
- **Task 3 (5m):** Write failing tests in `frontend-react/src/shared/ui/SearchableSelect.test.tsx`, implement `SearchableSelect.tsx`, and verify GREEN.
- **Task 4 (5m):** Replace all 7 numeric inputs and 7 select boxes across:
  - `src/app/App.tsx`
  - `src/features/master-data/MasterDataScreen.tsx`
  - `src/features/tariffs-meters/TariffsMetersScreen.tsx`
  - `src/features/field-reader/FieldReaderScreen.tsx`
  - `src/features/finance-cashier/FinanceCashierScreen.tsx`
  - `src/features/liff-portal/LiffPortalScreen.tsx`
- **Task 5 (5m):** Update existing Vitest tests/snapshots (`golden.test.tsx`, `app.test.tsx`, `userWorkflowE2E.test.tsx`) and extend Playwright E2E (`frontend-react/e2e/full_e2e_suite.py`) to verify formatted numeric input (`1,230`, `0.10`, `0`, blocking `01234`) and searchable select filtering.
- **Task 6 (5m):** Run `claude-bughunter` security check (`hunt-xss`, `hunt-business-logic`), full verification (`go test -v ./...`, `npm test`, `npm run build`, Playwright E2E with screenshots/videos), commit, push, and merge to `main`.
