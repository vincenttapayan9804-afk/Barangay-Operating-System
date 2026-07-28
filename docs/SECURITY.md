# Security Policy

## Supported Versions

Only the latest release receives security updates. We do not maintain backports for older versions.

| Version | Supported |
|---------|-----------|
| latest | ✅ Yes |
| < latest | ❌ No |

## Reporting a Vulnerability

We take security vulnerabilities seriously. If you discover a security issue, **please do not** open a public issue.

### Private disclosure channels

1. **GitHub Security Advisory** — Navigate to the repository's **Security** tab and click **"Report a vulnerability"**. This creates a private advisory visible only to maintainers.

2. **Email** — Contact the repository maintainer directly. The maintainer's email can be found through the commit history on the repository's main branch.

### What to expect

| Step | Timeline |
|------|----------|
| Acknowledgment | Within 48 hours of your report |
| Initial assessment | Within 5 business days |
| Fix timeline communicated | Within 10 business days |
| Public disclosure | After a fix is released |

### What to include

- **Description** — A clear overview of the vulnerability
- **Steps to reproduce** — Detailed reproduction steps or proof of concept
- **Potential impact** — What an attacker could achieve by exploiting this
- **Suggested fix** — Optional, but appreciated

## Security Architecture

### Authentication

- **Password-based auth** managed by GoTrue (self-hosted Supabase's auth service) with bcrypt password hashing. No open self-registration — accounts are provisioned only via GoTrue's admin API (`backend/scripts/bootstrap-platform-admin.mjs`, and the `create-barangay-admin` Edge Function backing the in-app staff-onboarding UI).
- **Passkeys (WebAuthn)** — optional passwordless sign-in via `backend/webauthn-service/`, a sidecar that owns the attestation/assertion cryptography (neither GoTrue nor PostgREST has native WebAuthn support) and mints a real session via GoTrue's admin API once a ceremony verifies. See `docs/DEPLOYMENT.md` "Passkey sign-in (WebAuthn)".
- **MFA** — `role=admin` accounts always require TOTP authenticator-app MFA before any data access; `role=staff` requires it only when their barangay's own `require_staff_mfa` flag is set. Enforced at the database layer, not just at login — see `app.mfa_satisfied()` in `backend/supabase/migrations/0000_auth_helpers.sql`, which every Row-Level Security policy funnels through.
- **Session tokens** — a Supabase JWT (access + refresh token pair), managed by `@supabase/supabase-js`'s own storage (`window.localStorage` by default). Be aware this means tokens are accessible to JavaScript — implement Content Security Policy headers and keep dependencies audited to mitigate XSS risks.
- **Rate limiting** — configurable via GoTrue's own rate-limit environment variables, and via Kong plugins in front of it.
- **Session expiry** — Access tokens expire (`GOTRUE_JWT_EXP`) and `@supabase/supabase-js` auto-refreshes or redirects to login.

### Authorization (RBAC)

Three roles, enforced **server-side by Postgres Row-Level Security** — not application code, and not bypassable by any client:

| Role | Scope |
|------|-------|
| **Admin** | Full access to all tables and user management |
| **Staff** | Create/update on records, documents, residents; limited delete |
| **Viewer** | Read-only access to most tables |

Every tenant-scoped table has RLS policies keyed off JWT claims stamped by a custom access-token hook (`backend/supabase/migrations/0003_custom_access_token_hook.sql`):

```sql
-- Only admins can delete households, and only within their own tenant
create policy households_delete on public.households for delete
  using (barangay_id = app.current_barangay_id() and app.current_role() = 'admin');
```

> **Important:** Client-side route guards are for UX convenience only. All authorization is enforced server-side by Postgres RLS, with `force row level security` set on every table (so not even the table owner bypasses it). Modifying the frontend code cannot bypass access controls.

### Network Security

- **Cloudflare Tunnel** — No open inbound ports on the server. An outbound-only connection is established from the server to Cloudflare's edge network.
- **WAF (Cloudflare)** — Cloudflare's free-tier Web Application Firewall protects against common web exploits (SQL injection, XSS, CSRF, etc.)
- **WAF (Coraza, self-hosted)** — A second, self-hosted WAF layer (`backend/waf/`, a custom Caddy build with the `coraza-caddy` module and the OWASP Core Rule Set) sits directly in front of `frontend`/Kong, screening requests Cloudflare's own free-tier managed rules don't cover. It is now the actual public entry point (ports 8080/8443) — `frontend`'s nginx no longer publishes any port to the host.
- **HTTPS** — All traffic through the tunnel is encrypted with TLS. Non-HTTPS connections are rejected by Cloudflare; the `waf` container terminates TLS for LAN/direct access (self-signed placeholder or mkcert — see `docs/DEPLOYMENT.md`).
- **Local Network** — LAN users access the server directly over HTTP/HTTPS through `waf`. The internal network is assumed to be trusted. Postgres's own port (`54322`) should remain LAN-only — only `waf`'s published ports need to be reachable at all.
- **Single public entry point** — Kong is the only way in for `auth`/`rest`/`realtime`/`functions`; every route requires an `apikey` header (anon or service_role) plus, for authenticated routes, a valid JWT.

### Data Security

- **Database** — PostgreSQL, access restricted to the containers that need it (`db:5432` is not published beyond `127.0.0.1` in the reference compose file)
- **Backups** — Continuous WAL archiving + periodic full/incremental backups via pgBackRest, encrypted in transit to S3-compatible storage (see `docs/DEPLOYMENT.md` "Continuous backups (pgBackRest)")
- **Environment Files** — `.env`, `.env.production`, and `.env.local` are gitignored, never committed to version control
- **No secrets in code** — API keys, tokens, and passwords are always in environment variables or gitignored files
- **JWT_SECRET / SERVICE_ROLE_KEY** — `JWT_SECRET` signs every access token and the long-lived `ANON_KEY`/`SERVICE_ROLE_KEY` pair (`backend/scripts/generate-supabase-keys.mjs`). `SERVICE_ROLE_KEY` bypasses Row-Level Security entirely and must never reach the frontend — it's used only by Edge Functions and operator scripts.

### Frontend Security

- **Input validation** — Client-side validation before sending data to the API (first line of defense; Postgres constraints + RLS are the authoritative check)
- **Error handling** — Generic error messages prevent information leakage about system internals
- **Content Security** — Vite builds with proper Content-Type headers and cache-control directives
- **Dependency auditing** — `npm audit` runs in CI to detect known vulnerabilities in dependencies

## Best Practices for Deployment

1. **Use HTTPS only** — Always access the app through the Cloudflare Tunnel (HTTPS). Do not expose Postgres or the internal `auth`/`rest` ports directly to the internet — only Kong's gateway and the frontend.

2. **Strong admin passwords** — Use unique, complex passwords for platform admin accounts, and always enroll TOTP MFA (required for `role=admin` regardless).

3. **Regular updates** — Keep the pinned image versions in `backend/supabase/docker-compose.yml` (Postgres, GoTrue, PostgREST, Realtime, Kong, edge-runtime) updated. Check each project's releases periodically.

4. **Review user accounts** — Periodically audit accounts via GoTrue's admin API. Remove inactive or unnecessary accounts.

5. **Database backups** — Verify pgBackRest backups are actually landing in your storage bucket (`pgbackrest info`), not just that the service is running.

6. **Monitor logs** — Check `docker compose logs` for each service regularly for unusual activity (failed login attempts, unauthorized access patterns, etc.).

7. **Review audit trail** — The finance module has a dedicated audit log (`finance_audit_logs`) that records every financial create/update/delete operation with user attribution. Review it periodically for unauthorized changes.

## Dependency Security

We use `npm audit` in CI to check for known vulnerabilities in dependencies:

```bash
cd frontend && npm audit --audit-level=high
```

- If a **critical** vulnerability is found, CI will flag it and work will begin on patching it
- If a **high** vulnerability is found in a direct dependency, an issue will be opened and prioritized
- **Moderate/low** vulnerabilities are tracked but may not be immediately patched

We encourage contributors to run `npm audit` locally before submitting pull requests.

### Static analysis & container/config scanning

Two additional scanners run in CI on every push to `main` and every pull request:

- **[Trivy](https://github.com/aquasecurity/trivy)** — scans the filesystem for vulnerable dependencies and leaked secrets, and scans `Dockerfile`/`docker-compose.yml` for misconfigurations (e.g. missing `USER`, exposed ports, insecure defaults). Fails the build on CRITICAL/HIGH findings.
- **[Semgrep](https://semgrep.dev/)** — static analysis (SAST) against the OWASP Top Ten, secrets, and TypeScript/React rulesets, using Semgrep's free public registry (no account/token required).

Both are free and open source, and require no external accounts to run.
