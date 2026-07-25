/// <reference path="../pb_data/types.d.ts" />

// Platform-admin tenant onboarding: adds an `is_platform_admin` flag to
// `users` and a "Platform Operations" pseudo-tenant so a small ops team can
// provision new barangays and their first admin from an in-app console
// instead of the raw PocketBase superuser panel (`/_/`). Platform admins are
// NOT granted access to any barangay's actual data (residents, finance,
// etc.) — only to the `barangays` registry and the ability to create the
// first `users` row for a new tenant. Everything else stays governed by the
// existing per-tenant rules from 1785000027_multi_tenant_barangays.js.

migrate((app) => {
  const usersColl = app.findCollectionByNameOrId("users");

  const hasFlag = usersColl.fields.some((f) => f.name === "is_platform_admin");
  if (!hasFlag) {
    const f = new BoolField();
    f.name = "is_platform_admin";
    f.required = false;
    usersColl.fields.push(f);
    console.log("users: is_platform_admin field added");
  } else {
    console.log("users: is_platform_admin already exists, skipping field add");
  }

  // A platform admin can create the first `users` row for any new tenant
  // (their own barangay_id won't match the new tenant's), in addition to the
  // existing "barangay admin invites into their own tenant" rule.
  usersColl.createRule =
    '(@request.body.barangay_id = @request.auth.barangay_id && @request.auth.role = "admin") || @request.auth.is_platform_admin = true';
  app.save(usersColl);
  console.log("users: createRule updated for platform admins");

  // ---- Seed the "Platform Operations" pseudo-tenant ----
  // Not a real barangay — just a home for platform-ops accounts so they can
  // still satisfy the required `barangay_id` relation like any other user.
  const existing = app.findRecordsByFilter("barangays", 'name = "Platform Operations"', "", 1, 0);
  let platformTenantId;
  if (existing.length === 0) {
    const barangaysColl = app.findCollectionByNameOrId("barangays");
    const rec = new Record(barangaysColl);
    rec.set("name", "Platform Operations");
    rec.set("active", true);
    app.save(rec);
    platformTenantId = rec.id;
    console.log(`barangays: seeded "Platform Operations" pseudo-tenant (id=${rec.id})`);
  } else {
    platformTenantId = existing[0].id;
    console.log('barangays: "Platform Operations" pseudo-tenant already exists, skipping');
  }

  // ---- Let platform admins manage the tenant registry ----
  const barangaysColl = app.findCollectionByNameOrId("barangays");
  barangaysColl.listRule = barangaysColl.viewRule =
    'id = @request.auth.barangay_id || @request.auth.is_platform_admin = true';
  barangaysColl.createRule = barangaysColl.updateRule = '@request.auth.is_platform_admin = true';
  // Deleting a tenant (and its cascade of real government data) stays a
  // deliberate superuser-only operation, not something the app UI exposes.
  barangaysColl.deleteRule = null;
  app.save(barangaysColl);
  console.log("barangays: rules updated for platform admins");

  console.log(
    `Platform admin setup complete. To create your first platform admin, use the PocketBase ` +
    `superuser panel (/_/) to create a "users" record with role=admin, is_platform_admin=true, ` +
    `and barangay_id="${platformTenantId}" (the "Platform Operations" tenant).`
  );
});
