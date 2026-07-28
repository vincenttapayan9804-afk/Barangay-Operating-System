# Threat Model

A STRIDE-style pass over CLUSTR's actual architecture (see `docs/ARCHITECTURE.md` for the full
system diagram). This is a living document — update it whenever a new trust boundary, data flow,
or asset is introduced (e.g. the Security Roadmap phases tracked in this repo's task list).

## Assets

| Asset | Where it lives | Sensitivity |
|---|---|---|
| Resident PII (name, address, income, household composition) | `residents`, `households`, `household_members` tables | High — see `docs/DATA_CLASSIFICATION.md` |
| Blotter/incident records | `blotter_records` | High — often involves minors, victims, ongoing disputes |
| Finance records (budget, disbursements, revenues) | `fund_sources`, `appropriations`, `disbursements`, `revenues`, `finance_audit_logs` | High — statutory/audit exposure |
| Credentials & session tokens | GoTrue (`auth.users`), browser localStorage, WebAuthn credentials (`webauthn_credentials`) | Critical |
| Service secrets (JWT signing key, service-role key, DB password) | Self-hosted Infisical (`backend/infisical/`), rendered into `backend/supabase/.env` at deploy time (Phase 5) | Critical |
| Audit trail (`activity_logs`, `finance_audit_logs`) | Postgres | High — must be tamper-evident (Phase 3) |
| Released documents (clearances, certificates) | Generated PDFs + `document_requests`, hash-chained release events in `document_release_chain` (Phase 7) | Medium — forgeable if verification is weak |
| Face templates (biometric data) | CompreFace's own store only (`backend/compreface/`), keyed by subject = user id; never this Postgres database | Critical — biometric data is irrevocable if leaked, unlike a password |

## Trust boundaries

1. **Public internet ↔ Cloudflare Tunnel** — only entry point; no inbound ports open on the host.
2. **Cloudflare Tunnel ↔ nginx (frontend)** — serves the static SPA; also proxies `/rest/v1`,
   `/auth/v1`, `/realtime/v1`, `/functions/v1` to Kong.
3. **nginx ↔ Kong** — Kong is the single public entry point for every backend service
   (`backend/supabase/kong.yml`); every route requires an `apikey` (anon/service_role) plus ACL.
4. **Kong ↔ {auth, rest, realtime, edge-runtime, webauthn}** — internal Docker network only, not
   independently reachable from outside.
5. **Edge Functions / webauthn-service ↔ Postgres** — via the `service_role` key, which bypasses
   RLS entirely; this key must never reach the frontend (`docs/SECURITY.md` already calls this out).
6. **Tenant ↔ tenant** — one shared Postgres database; the only isolation boundary is RLS's
   `barangay_id = app.current_barangay_id()` check on every tenant-scoped table.
7. **edge-runtime ↔ CompreFace** (Phase 6) — a new external network hop (`compreface_net`) added
   specifically for `login-gate`/`enroll-face`; CompreFace is a new trusted component with its own
   attack surface (`backend/compreface/docker-compose.yml`), loopback-only admin UI, reached only
   by container name, never through Kong or the public WAF ingress.

## STRIDE pass

| Category | Threat | Existing mitigation | Gap addressed by this roadmap |
|---|---|---|---|
| **S**poofing | Credential stuffing / brute force against login | GoTrue rate-limit env vars, nginx `auth_limit` zone, Kong-level rate limiting (Phase 3) | Closed — Phase 6's `login-gate` Edge Function proxies the password grant server-side to count failures authoritatively, and requires a CompreFace face match on the next login once an account hits 3 failures, regardless of whether the password given is correct |
| **S**poofing | Forged/reused document certificates | QR code + `/verify/:id` lookup | Closed — Phase 7 chains each release event's snapshot (`document_release_chain`, same SHA-256 technique as Phase 3) and `/verify/:id` now shows a "tamper-evident, chain verified" badge, recomputed live rather than just displayed |
| **T**ampering | Historical audit-log rows edited directly in Postgres (e.g. by a compromised service-role key) | RLS denies UPDATE/DELETE on `activity_logs`/`finance_audit_logs` | Phase 3 (hash-chain makes tampering *detectable*, not just policy-denied) |
| **T**ampering | Unsigned Cloudinary upload preset lets anyone upload arbitrary files under the app's account | None today | Phase 3 (signed uploads or Supabase Storage + bucket RLS) |
| **R**epudiation | A user denies performing a destructive action | `activity_logs`/`finance_audit_logs` record user attribution | Phase 3 hash-chain strengthens non-repudiation |
| **I**nformation disclosure | XSS reading the session token out of `localStorage` | HttpOnly not used (SPA + supabase-js default); existing security headers (X-Frame-Options, HSTS, nosniff) | Phase 2 (CSP — the actual mitigation for XSS-based token theft, since a BFF/HttpOnly-cookie model isn't feasible without one) |
| **I**nformation disclosure | Verbose error messages leaking stack traces / internals | Frontend error boundary, "generic error messages" convention | Phase 3 (shared fail-secure error wrapper for all Edge Functions) |
| **I**nformation disclosure | Secrets committed to git or leaked via logs | `.env*` gitignored, Trivy secret scan in CI, Phase 5's self-hosted Infisical (`backend/infisical/`) as the single managed store real secrets are rendered from | Closed — Infisical's own bootstrap secrets (`ENCRYPTION_KEY`/`AUTH_SECRET`/its DB password) remain the one unavoidable root of trust, documented in `docs/DEPLOYMENT.md` |
| **D**enial of service | Scripted abuse of write-heavy endpoints (mass record creation, finance entry spam) | None at Kong today | Phase 3 (Kong rate-limiting / anti-automation) |
| **D**enial of service | Generic web attacks (SQLi/XSS scanners, known exploit signatures) | Cloudflare's free-tier WAF, plus Phase 4's self-hosted Coraza/OWASP CRS layer in front of nginx/Kong (`docs/SECURITY.md` "Network Security") | Closed |
| **E**levation of privilege | A viewer/staff account attempting an admin-only action via direct API call | Server-side RLS on every table, `force row level security` set repo-wide | Phase 3 verifies this repo-wide as part of the DB hardening pass |
| **E**levation of privilege | Compromised low-privilege account escalating via a stolen session | MFA required for admin/staff-with-flag, WebAuthn available | Closed — Phase 6's face step-up applies to every role (staff/admin/viewer), not just MFA-required roles, once an account shows signs of a brute-force attempt |
| **E**levation of privilege | An account with no face template enrolled reaches the 3-failed-attempt threshold, and login-gate can't ask for a second factor it has nothing to check against | N/A (new surface, Phase 6) | Closed — fails closed: the account is soft-locked (423, admin-unlock required — see Settings' "Locked Accounts" panel) rather than silently skipping the face check |

## Out of scope for this document

- Physical security of barangay office hardware — outside this repo's control.
- Zero-Knowledge Proofs / Selective Disclosure — no concrete threat or use case identified yet;
  see the Security Roadmap's "Explicitly dropped" section.
- DICT eGovDX / GovCloud — threat modeling for those integrations happens once real credentials
  and endpoint specs exist (Phase 8 ships stubs only).
