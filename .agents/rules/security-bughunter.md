# Security & Vulnerability Hunting Rule (`Claude-BugHunter`)

Ref: [elementalsouls/Claude-BugHunter](https://github.com/elementalsouls/Claude-BugHunter)

## 1. Mandatory Security Skill Activation
- Whenever designing, implementing, modifying, or reviewing Go Echo REST handlers, Keycloak OIDC / JWT blacklist verification, PostgreSQL Multi-Tenant Row-Level Security (RLS), Offline-First sync endpoints, Hybrid OCR / avatar uploads, or LINE LIFF views, the agent **MUST** invoke the corresponding **Claude-BugHunter** (`claude-bughunter`) skills alongside **Superpowers**.
- Apply the 4-layer BugHunter methodology:
  1. **Think (`bb-methodology` & `redteam-mindset`):** Analyze multi-tenant trust boundaries (`org_id`), JWT claims, and offline batch sync payloads.
  2. **Hunt (`hunt-*` vulnerability class skills):** Probe and audit code against specific vulnerability classes (`hunt-jwt`, `hunt-oauth`, `hunt-auth-bypass`, `hunt-idor`, `hunt-sqli`, `hunt-xss`, `hunt-file-upload`, `hunt-business-logic`, `hunt-race-condition`, `hunt-api-misconfig`, `hunt-cors`).
  3. **Validate (`triage-validation`):** Run the **7-Question Validation Gate** (root cause, reproduction proof, trust boundary violation, real impact) before reporting or claiming security readiness.
  4. **Hygiene (`evidence-hygiene`):** Never expose, log, or commit Keycloak client secrets, JWT signing keys, ElevenLabs API keys, PostgreSQL credentials, or citizen PII (`token-scan` discipline).

## 2. Pre-Completion Security Gate
- Before `superpowers:verification-before-completion` passes, verify that all newly introduced or modified code paths have been audited against their applicable `hunt-*` vulnerability classes and contain zero hardcoded secrets or unvalidated inputs.
