/// <reference path="../pb_data/types.d.ts" />

// Require a second factor (password + emailed one-time code) for admin-role
// accounts (barangay admins and platform admins) — the accounts with write
// access to real resident/finance PII and, for platform admins, the ability
// to provision new tenants. Staff/viewer accounts are left on password-only
// auth for now to keep this rollout narrow and low-risk.
//
// NOTE: OTP emails require SMTP to be configured in PocketBase Settings ->
// Mail before this is usable in production — see docs/DEPLOYMENT.md.

migrate((app) => {
  const usersColl = app.findCollectionByNameOrId("users");

  usersColl.otp.enabled = true;
  usersColl.otp.duration = 5 * 60; // the emailed code is valid for 5 minutes

  usersColl.mfa.enabled = true;
  usersColl.mfa.duration = 10 * 60; // 10 minutes to complete the 2nd factor
  usersColl.mfa.rule = 'role = "admin"';

  app.save(usersColl);
  console.log("users: MFA (password + email OTP) enabled for role=admin");
});
