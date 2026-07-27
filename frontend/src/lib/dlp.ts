// Security Phase 3 DLP: redacts Sensitive-tier data (per
// docs/DATA_CLASSIFICATION.md) out of free-text audit-log details before
// they're ever written to activity_logs/finance_audit_logs. Applied at the
// single write choke point (createActivity/createFinanceAuditLog) so a
// future call site that accidentally interpolates a raw email/phone/PhilSys
// number into a details string doesn't leak it into the log — the doc's
// "must never store a Sensitive-tier field's raw value in a diff" rule,
// enforced in code rather than by convention alone.

const EMAIL_RE = /[^\s@]+@[^\s@]+\.[^\s@]+/g
const PH_MOBILE_RE = /\b09\d{9}\b/g
const PHILSYS_RE = /\b\d{4}-\d{4}-\d{4}-\d{4}\b/g

export function redactSensitiveText(text: string): string {
  if (!text) return text
  return text
    .replace(PHILSYS_RE, '[REDACTED PHILSYS ID]')
    .replace(EMAIL_RE, '[REDACTED EMAIL]')
    .replace(PH_MOBILE_RE, '[REDACTED MOBILE]')
}
