/// <reference path="../pb_data/types.d.ts" />

// Make staff-role MFA an opt-in, per-tenant setting rather than a global
// flip. The original rollout (1785000029_admin_mfa.js) scoped MFA to
// role=admin only, deliberately narrow. Blanket-extending it to every
// staff login everywhere would add real friction for barangays doing
// routine daily data entry, and (found while verifying this migration
// locally) breaks the tenant-isolation CI check, which authenticates as a
// plain staff user by design. A per-tenant toggle gets the security
// benefit to barangays that want it without forcing it on every
// deployment or entangling it with an unrelated isolation test.
//
// A barangay opts in via `barangays.require_staff_mfa`, toggled from the
// /platform-admin console (barangays.updateRule is platform-admin-only —
// a tenant's own admin can't touch that collection, same as `active`, so
// this can't be self-service without loosening a rule that also guards
// tenant suspension). Defaults to false, so nothing changes for existing
// tenants until a platform operator turns it on for them.

migrate((app) => {
  const barangaysColl = app.findCollectionByNameOrId("barangays");
  const hasField = barangaysColl.fields.some((f) => f.name === "require_staff_mfa");
  if (!hasField) {
    const requireStaffMfaField = new BoolField();
    requireStaffMfaField.name = "require_staff_mfa";
    requireStaffMfaField.required = false;
    barangaysColl.fields.push(requireStaffMfaField);
    app.save(barangaysColl);
    console.log("barangays: require_staff_mfa field added");
  } else {
    console.log("barangays: require_staff_mfa field already exists, skipping");
  }

  const usersColl = app.findCollectionByNameOrId("users");
  usersColl.mfa.rule = 'role = "admin" || (role = "staff" && barangay_id.require_staff_mfa = true)';
  app.save(usersColl);
  console.log("users: MFA rule now admin-always, staff opt-in per tenant");
});
