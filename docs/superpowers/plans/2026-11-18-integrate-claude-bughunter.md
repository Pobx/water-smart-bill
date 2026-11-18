# Claude-BugHunter Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate the `Claude-BugHunter` security & bug-hunting skill framework into `water-smart-bill` alongside `Superpowers`.

**Architecture:**
- Add modular security rule `.agents/rules/security-bughunter.md`.
- Update `AGENTS.md` (and `GEMINI.md` symlink) with the 10-stage Superpowers + Claude-BugHunter lifecycle and repository-specific attack-surface mapping.
- Record ADR 0008 in `docs/adr/` and update `docs/adr/README.md`.

**Tech Stack:** Markdown, Git, Go 1.24+ (Echo Hexagonal), React 18 / TypeScript (Vertical Slice).

---

### Task 1: Integrate Claude-BugHunter into Repository Rules & ADR

- [x] **Step 1: Create `.agents/rules/security-bughunter.md`**
- [x] **Step 2: Update `AGENTS.md` with Claude-BugHunter lifecycle and attack-surface matrix**
- [x] **Step 3: Create ADR 0008 and update `docs/adr/README.md`**
- [x] **Step 4: Run verification suite and merge to `main`**
