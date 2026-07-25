# webauthn-service

Sidecar service handling passkey (WebAuthn) registration and sign-in for CLUSTR.

PocketBase has no native WebAuthn support, so the actual attestation/assertion cryptography
(CBOR + COSE key parsing, ECDSA/RSA signature verification) lives here, using the audited
[`@simplewebauthn/server`](https://simplewebauthn.dev/) library — it is **not** reimplemented in a
PocketBase JS hook. Credentials are stored in the `webauthn_credentials` PocketBase collection
(`backend/pb_migrations/1785000032_webauthn_credentials.js`), which this service reads/writes
using a dedicated superuser account. After a login ceremony verifies, it mints a real PocketBase
session for the user via the superuser `impersonate` API — the frontend never has to know a
second backend exists.

See `docs/DEPLOYMENT.md` → "Step 8: Passkey sign-in (WebAuthn)" for setup instructions, and
`docs/SECURITY.md` for the security model.

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `PORT` | no (default `8091`) | Port the service listens on |
| `PB_URL` | no (default `http://pocketbase:8090`) | Internal PocketBase URL |
| `PB_SUPERUSER_EMAIL` | **yes** | A dedicated superuser account (don't reuse your personal admin login) |
| `PB_SUPERUSER_PASSWORD` | **yes** | That superuser's password |
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
