# Data Classification

Every table in `backend/supabase/migrations/` classified by sensitivity, per RA 10173 (Data
Privacy Act) categories plus a general severity tier. This feeds Phase 3's DLP masking (redact
`sensitive`-tier fields from logs/exports by default) and should be re-checked whenever a migration
adds a new column.

**Tiers:**
- **Public** — safe to display without authentication (e.g. document verification page).
- **Internal** — visible to any authenticated tenant user (viewer role and up).
- **Restricted** — visible only to staff/admin roles; excluded from viewer-facing exports.
- **Sensitive** — RA 10173 "sensitive personal information" or otherwise high-harm-if-leaked;
  must be masked in logs and non-essential exports even for staff/admin.

| Table | Tier | Sensitive fields |
|---|---|---|
| `residents` | **Sensitive** | `philsys_card_no`, `blood_type`, `pregnant_woman`, `mother_maiden_*` (classic KBA/identity-theft vector), `mobile_number`, `email_address`, full address fields |
| `households` | Restricted | `monthly_income`, full address |
| `household_members` | Restricted | relationship + demographic fields |
| `migrant_info` | Restricted | migration history, origin address |
| `deceased_records` | Sensitive | cause of death, full identity fields |
| `blotter_records` | **Sensitive** | incident narrative, parties involved (often minors/victims) |
| `document_requests` | Restricted | purpose of request, linked resident identity |
| `visitor_logs` | Internal | visitor name/purpose (lower harm, short retention) |
| `activity_logs` | Restricted | user attribution + before/after diffs (may embed sensitive fields from the row being changed — masking must be diff-aware, see Phase 3) |
| `finance_audit_logs` | Restricted | financial transaction detail + user attribution |
| `fund_sources` / `appropriations` / `disbursements` / `revenues` / `income_accounts` | Internal | statutory financial data, already public-interest by nature for a LGU |
| `assets` | Public/Internal | barangay-owned property inventory |
| `meetings` / `agenda_items` / `calendar_events` | Internal | council scheduling |
| `system_settings` | Internal | barangay configuration, no PII |
| `barangays` | Public | tenant metadata |
| `profiles` | Restricted | staff/admin's own identity fields |
| `webauthn_credentials` | **Sensitive** | public key material tied to a specific person's device |

## Handling rules derived from this classification

1. **Logging** — `activity_logs`/`finance_audit_logs` entries must never store a Sensitive-tier
   field's raw value in a diff; Phase 3 adds a masking helper keyed off this table.
2. **Exports** (CSV/PDF via `frontend/src/features/reports`) — Sensitive-tier fields are redacted
   by default; an explicit "include sensitive fields" action (admin-only, itself logged) is
   required to include them.
3. **Anonymized reporting** (Phase 9, ARX) — any dataset leaving the system for
   DILG/regional-office reporting must run through k-anonymity on Sensitive + Restricted fields
   first.
4. **Biometric enrollment data** (Phase 6, CompreFace) is its own **Sensitive** category — face
   embeddings for staff/admin/viewer accounts, stored only in the CompreFace sidecar's own
   database, never joined into the main `residents`/`profiles` tables.
