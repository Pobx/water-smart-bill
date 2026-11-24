# Repository Rules Compliance Remediation Plan (`water-smart-bill`)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring `water-smart-bill` into 100% compliance with all rules in `AGENTS.md` and `.agents/rules/` (`git-workflow.md`, `adr-tracking.md`, `security-bughunter.md`).

**Architecture:**
- Harden `UploadHomeownerAvatar` (`backend-go/adapters/web/rest/handler/water_bill_rest.go`) against `hunt-file-upload` & `hunt-xss` (strict 5MB file size limit, extension & magic-byte MIME whitelist for `.png`/`.jpg`/`.jpeg`/`.webp`, and safe URL scheme validation on JSON `avatar_url`).
- Author ADR 0009 (Role-Based Access Control, Left Menu Navigation, Mobile Card Views & Cash-Only Cashier Policy) and ADR 0010 (Golden Master Testing Suite, Auto-Migration Runner & Cross-Platform Docker Automation) and update `docs/adr/README.md`.
- Run full verification suites for both `backend-go` (`go test -v ./...`) and `frontend-react` (`npm test && npm run build`).
- Merge via `--no-ff` into `main` and push to `origin`.

**Tech Stack:** Go 1.24+, Echo v4, React 18, TypeScript, Vitest, Git.

---

### Task 1: TDD Security Hardening (`hunt-file-upload` & `hunt-xss`)

- [x] **Step 1: Add failing test `TestUploadHomeownerAvatarSecurityValidation` in `backend-go/adapters/web/rest/server_test.go`**
- [x] **Step 2: Implement MIME, extension, size, and URL scheme validation in `backend-go/adapters/web/rest/handler/water_bill_rest.go`**
- [x] **Step 3: Verify tests pass**

### Task 2: Author Missing ADRs (0009 & 0010) and Update Index

- [x] **Step 1: Create `docs/adr/0009-rbac-left-menu-mobile-card-views-and-cash-only-policy.md`**
- [x] **Step 2: Create `docs/adr/0010-golden-master-testing-auto-migrations-and-docker-automation.md`**
- [x] **Step 3: Update `docs/adr/README.md` and `docs/adr/0006-finance-cashier-invoicing-receipts-and-csv-export.md`**

### Task 3: Full Verification & `--no-ff` Merge to `main`

- [x] **Step 1: Run `cd backend-go && go test -v ./...` and `cd frontend-react && npm test && npm run build`**
- [x] **Step 2: Commit, push branch, merge `--no-ff` into `main`, and push `origin/main`**
