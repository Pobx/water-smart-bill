# Initialize Superpowers Framework Implementation Plan for water-smart-bill

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the unified Superpowers framework and autonomous execution workflow pattern for `water-smart-bill` to match the exact pattern of the workspace repositories (`bot-trade`, `pios`, `workflow-fb-page-auto-post`, `FileScanProject`).

**Architecture:** 
- Unified rule files in `.agents/rules/` (`autonomous-editing.md`, `git-workflow.md`, `adr-tracking.md`).
- Unified master `AGENTS.md` specifying exclusive Superpowers methodology, stage-gated lifecycle, skill matrix, full autonomous execution rules (branch -> commit -> push -> merge to primary branch -> push primary), and repo guidelines.
- `GEMINI.md` symlinked to `AGENTS.md` for zero-drift cross-harness compatibility.
- Initial ADR 0001 and ADR template in `docs/adr/`.

**Tech Stack:** Git, Markdown, Shell.

**Spec:** Unified Superpowers Pattern Specification.

## Global Constraints
- Adhere to the 9-stage Superpowers lifecycle.
- Full Autonomous execution: create task branch from primary (`main`), verify via tests, commit with conventional commit, push task branch, merge into primary branch, push primary branch to origin.
- Maintain `docs/adr/` with `template.md` and index in `README.md`.
- `GEMINI.md` must be a symlink to `AGENTS.md`.

---

### Task 1: Bootstrap & Commit Superpowers Pattern

- [x] **Step 1: Create repository structure & rules**
  Create `.agents/rules/`, `docs/adr/`, `docs/superpowers/`.
- [x] **Step 2: Create `AGENTS.md` & `GEMINI.md` symlink**
  Write `AGENTS.md` and link `GEMINI.md -> AGENTS.md`.
- [x] **Step 3: Create initial ADR 0001**
  Document adoption of Superpowers and Full Autonomous Git Workflow.
- [ ] **Step 4: Commit on `chore/unify-superpowers-pattern`, push branch, merge into `main`, and push `main`**
  Execute git workflow and push to origin.
