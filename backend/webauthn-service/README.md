# webauthn-service

Sidecar service handling passkey (WebAuthn) registration and sign-in for CLUSTR.

Self-hosted Supabase (like PocketBase before it) has no native WebAuthn support, so the actual
attestation/assertion cryptography (CBOR + COSE key parsing, ECDSA/RSA signature verification)
lives here, using the audited [`@simplewebauthn/server`](https://simplewebauthn.dev/) library — it
is **not** reimplemented as a Postgres function. Credentials are stored in the
`webauthn_credentials` table (`backend/supabase/migrations/0025_webauthn_credentials.sql`), which
this service reads/writes directly via PostgREST using the `service_role` key (RLS explicitly has
no insert/update policy on that table at all — service-role-only by design, see that migration's
own header comment). After a login ceremony verifies, it mints a real GoTrue session for the user
via `POST /auth/v1/admin/generate_link` + a server-side `/verify` redemption (see `server.mjs`'s
`mintSessionForUser`, and `backend/supabase/PHASE3_NOTES.md` for why this specific redemption path
was chosen) — the frontend never has to know a second backend exists.

See `docs/DEPLOYMENT.md` → "Step 8: Passkey sign-in (WebAuthn)" for setup instructions, and
`docs/SECURITY.md` for the security model.

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `PORT` | no (default `8091`) | Port the service listens on |
| `SUPABASE_URL` | no (default `http://kong:8000`) | Kong's internal URL (the stack's single entry point — see `backend/supabase/docker-compose.yml`) |
| `SUPABASE_ANON_KEY` | **yes** | Used for user-context calls (`/auth/v1/user`, `/auth/v1/verify`) |
| `SUPABASE_SERVICE_ROLE_KEY` | **yes** | Used for RLS-bypassing calls (credential CRUD, email lookup RPC, `/admin/generate_link`) — don't expose this to the frontend |
| `RP_ID` | no (default `localhost`) | WebAuthn Relying Party ID — must be a valid domain (no scheme/port); passkeys are bound to it |
| `RP_NAME` | no (default `CLUSTR Barangay OS`) | Display name shown by the platform's passkey UI |
| `WEBAUTHN_ORIGINS` | no (default `http://localhost:8080`) | Comma-separated list of exact origin(s) (scheme + host + port) the app is served from |

## Endpoints

All mounted under `/api/webauthn/`, proxied there by nginx (`frontend/nginx.conf`) so the browser
only ever talks to its own origin:

- `POST /api/webauthn/register/options` — requires `Authorization: Bearer <session token>`
- `POST /api/webauthn/register/verify` — requires `Authorization: Bearer <session token>`
- `POST /api/webauthn/login/options` — public, body `{ email }`
- `POST /api/webauthn/login/verify` — public, body `{ email, assertionResponse }`
- `GET /api/webauthn/health`
