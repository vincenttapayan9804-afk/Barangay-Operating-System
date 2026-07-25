/// <reference path="../pb_data/types.d.ts" />

// Fixes a real cross-tenant collision bug found while load-testing Phase 2:
// `households.household_number` and `blotter_records.case_number` both had
// database-wide UNIQUE indexes that predate multi-tenancy (1783616210). In
// practice every barangay numbers its own households/cases independently
// (e.g. "001", "2024-01"), so under the old global constraint the second
// barangay to ever use a given number would get a hard 400 — a real bug,
// not a hypothetical one. Replace both with (barangay_id, <number>) unique
// indexes, matching the pattern already used for system_settings in
// 1785000027_multi_tenant_barangays.js.
//
// `users.email` stays globally unique — that one is intentional, since
// PocketBase's own auth login is by email with no tenant selector.

migrate((app) => {
  const households = app.findCollectionByNameOrId("households");
  if ((households.indexes || []).some((i) => i.includes("idx_households_number"))) {
    households.removeIndex("idx_households_number");
  }
  // Replace the non-unique composite added in 1785000030 with a unique one.
  households.indexes = (households.indexes || []).filter((i) => !i.includes("idx_households_barangay_number"));
  households.indexes.push("CREATE UNIQUE INDEX idx_households_barangay_number ON households (barangay_id, household_number)");
  app.save(households);
  console.log("households: household_number uniqueness rescoped to per-barangay");

  const blotter = app.findCollectionByNameOrId("blotter_records");
  if ((blotter.indexes || []).some((i) => i.includes("idx_blotter_case_number"))) {
    blotter.removeIndex("idx_blotter_case_number");
  }
  if (!(blotter.indexes || []).some((i) => i.includes("idx_blotter_barangay_case_number"))) {
    blotter.indexes = [
      ...(blotter.indexes || []),
      "CREATE UNIQUE INDEX idx_blotter_barangay_case_number ON blotter_records (barangay_id, case_number)",
    ];
  }
  app.save(blotter);
  console.log("blotter_records: case_number uniqueness rescoped to per-barangay");
});
