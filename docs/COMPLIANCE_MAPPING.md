# Compliance & Standards Mapping

CLUSTR is not formally certified against any framework below — this document maps the technical
controls that exist (or are planned) in this repo to what each framework/standard actually asks
for, so a barangay's Data Protection Officer or a would-be assessor can see the real state at a
glance. Status is updated as each Security Roadmap phase lands; see the repo's task list for phase
tracking.

**Legend:** ✅ Implemented · 🔜 Planned (roadmap phase noted) · ⛔ Not applicable / out of scope
for a project this size · 📋 Requires an external submission/audit — this repo can only prepare
evidence, not self-certify.

## OWASP ASVS (Application Security Verification Standard) — Levels 2 & 3

| Control area | Status | Where |
|---|---|---|
| Browser security headers | ✅ Phase 2 — CSP added alongside the existing X-Frame-Options/HSTS/nosniff/Referrer-Policy/Permissions-Policy | `frontend/nginx.conf` |
| Allow-list input validation | ✅ Phase 2 (zod) on residents/households/disbursements; other forms still hand-rolled | `frontend/src/lib/schemas/*`, `frontend/src/features/*` |
| Secure session token handling | ✅ Phase 2 — PKCE flow, GoTrue refresh-token rotation, 15-minute access-token TTL | `frontend/src/lib/supabaseClient.ts`, `backend/supabase/docker-compose.yml` |
| Production code sanitization | ✅ Phase 2 — sourcemaps off, console/debugger stripped from prod bundle, generic top-level error boundary | `frontend/vite.config.ts`, `frontend/src/main.tsx` |
| Database hardening & parameterized queries | ✅ Phase 3 — verified repo-wide: all 24 tables have both `enable` and `force row level security`; PostgREST/RPC-only access already parameterizes by construction; grants already minimal (explicit revokes for `document_requests`/`lookup_user_id_by_email`) | `backend/supabase/migrations`, `backend/supabase/verify/01_grants.sql` |
| Fail-secure error handling | ✅ Phase 3 — only deliberately-thrown `HttpError`s reach the client; any other exception (fetch failure, DB error) becomes a fixed generic message, full detail still server-logged | `backend/supabase/functions/_shared/http.ts` |
| Cryptographic log integrity | ✅ Phase 3 — SHA-256 hash-chained `activity_logs`/`finance_audit_logs` (`prev_hash`/`row_hash`, per-tenant), admin-only `verify_*_chain()` RPCs, tamper detection proven via a dedicated test | `backend/supabase/migrations/0030_audit_log_hash_chain.sql`, `backend/supabase/verify/02_seed_and_assertions.sql` |
| Business logic & anti-automation | ✅ Phase 3 — Kong rate-limiting (`limit_by: ip`) on `/auth/v1/*` and write methods on `/rest/v1/*`/`/functions/v1/*`; Phase 6 (biometric step-up) still planned on top | `backend/supabase/kong.yml` |
| Secure file handling & uploads | ✅ Phase 3 — Cloudinary signed uploads (secret held server-side only, replacing the old unsigned upload_preset), client-side MIME/size allow-list | `backend/supabase/functions/sign-cloudinary-upload`, `frontend/src/api/upload.ts` |
| RBAC enforced server-side | ✅ Already done — RLS, not app code | `backend/supabase/migrations/000*` |
| MFA | ✅ Already done — TOTP (GoTrue) + WebAuthn | `backend/webauthn-service` |

## NIST Cybersecurity Framework (CSF) 2.0

| Function | Status | Notes |
|---|---|---|
| **Govern** | ✅ Phase 1 (this doc + threat model formalize policy) | `docs/THREAT_MODEL.md` |
| **Identify** | ✅ Data classification (Phase 1), asset inventory in threat model | `docs/DATA_CLASSIFICATION.md` |
| **Protect** | ✅ RLS/RBAC/MFA/backups/rate-limiting today; 🔜 Phases 4–6 close the remaining gaps | multiple |
| **Detect** | ✅ Phase 3 — hash-chained audit logs make tampering detectable, not just logged | `backend/supabase/migrations/0030_audit_log_hash_chain.sql` |
| **Respond** | ✅ `docs/SECURITY.md` vulnerability-disclosure process | `docs/SECURITY.md` |
| **Recover** | ✅ pgBackRest continuous backups | `docs/DEPLOYMENT.md` |

## CIS Critical Security Controls v8 (Implementation Group 1 subset relevant here)

| Control | Status |
|---|---|
| CIS 3 — Data Protection | ✅ Phase 1 classification + Phase 3 DLP masking (write-time redaction in `activity_logs`/`finance_audit_logs`, redacted-by-default exports) |
| CIS 4 — Secure Configuration | ✅ Trivy config scan in CI; 🔜 Phase 5 removes plaintext secrets |
| CIS 5 — Account Management | ✅ GoTrue admin-API-only provisioning, no open self-registration |
| CIS 6 — Access Control Management | ✅ RLS-enforced RBAC |
| CIS 8 — Audit Log Management | ✅ today, ✅ Phase 3 cryptographic integrity |
| CIS 13 — Network Monitoring & Defense | 🔜 Phase 4 (WAF second layer beyond Cloudflare) |

## DICT Secure Software Development Lifecycle (SDLC)

Philippine DICT's secure-SDLC guidance maps to process controls this repo already has via CI, plus
documentation this phase adds:

| Requirement | Status |
|---|---|
| Static analysis (SAST) in CI | ✅ Semgrep (OWASP Top Ten, secrets, TS/React rulesets) |
| Dependency vulnerability scanning | ✅ `npm audit`, Trivy |
| Secrets scanning | ✅ Trivy |
| Software Bill of Materials (SBOM) | ✅ Phase 1 (`cyclonedx-npm` in CI) |
| Documented threat model | ✅ Phase 1 (`docs/THREAT_MODEL.md`) |
| Formal secure-coding policy / branch protection | 📋 Administrative — set branch-protection rules and a `CODEOWNERS` file in GitHub settings; not a code change |

## NIST Privacy Framework

Overlaps heavily with the Philippine Data Privacy Act (RA 10173) work already done in
`docs/PRIVACY_NOTICE.md` and `docs/DATA_PROCESSING_AGREEMENT.md`. Phase 1's data classification
doc is the missing "Identify-P" piece; Phase 3's DLP masking is the "Protect-P" piece.

## OWASP Open Source Security

Covered by: `npm audit` + Trivy (known-vulnerability scanning) already in CI, plus Phase 1's new
SBOM/license-scanning job (below) for supply-chain transparency.

## OpenChain (ISO/IEC 5230 & ISO/IEC 18974)

| Requirement | Status |
|---|---|
| Declared license (MIT) | ✅ Root `LICENSE` |
| No copyleft (GPL/AGPL) dependencies | ✅ Verified — 0 matches across `frontend` and `backend/webauthn-service` |
| SBOM generation | ✅ Phase 1 |
| License-compliance CI gate | ✅ Phase 1 (fails build on GPL/AGPL) |
| Formal OpenChain conformance self-certification | 📋 An administrative self-declaration submitted to the OpenChain project once the above are in place — not a code change |

## CSA STAR Level 1 / UK Cyber Essentials / Essential Eight (Australian ACSC)

These are **self-assessment or third-party-audited certifications**, not software:

- **CSA STAR Level 1** — a self-assessment questionnaire (CAIQ) submitted to the CSA STAR
  Registry. This repo's technical controls (once Phases 2–6 land) supply the evidence; the
  questionnaire submission itself is an administrative action for whoever operates the production
  deployment, outside this codebase.
- **UK Cyber Essentials** — requires a paid, externally-audited certification process. Out of
  scope for a Philippine barangay system; noted here only because it was on the original request
  list.
- **Essential Eight** — an Australian government baseline (patching, MFA, application control,
  restricting admin privileges, etc.). The *controls* it asks for are already substantially
  covered by this repo's MFA/RBAC/patching practices; formal Essential Eight maturity-level
  self-assessment is, again, an administrative exercise for the operating organization.

## Explicitly not pursued

- **Zero-Knowledge Proofs / Selective Disclosure** — see `docs/THREAT_MODEL.md`; no concrete use
  case identified for this system today.
