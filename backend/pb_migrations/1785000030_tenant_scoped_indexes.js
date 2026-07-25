/// <reference path="../pb_data/types.d.ts" />

// Every tenant-owned collection's list/view rule now leads with
// `barangay_id = @request.auth.barangay_id` (1785000027_multi_tenant_barangays.js),
// so barangay_id is an equality filter on effectively every query — but it
// was never indexed. Add barangay_id as the leading column of a composite
// index on the highest-row-count / most frequently queried collections, so
// that filter doesn't force a full table scan as tenant data grows.
//
// Deliberately scoped to collections likely to hold real volume (residents,
// households, logs, ...) rather than every one of the ~20 tenant collections
// — small tables (users, assets, fund_sources, meetings) don't need it and
// extra indexes aren't free on writes.

migrate((app) => {
  const specs = [
    { name: "residents", index: "CREATE INDEX idx_residents_barangay_name ON residents (barangay_id, last_name, first_name)" },
    { name: "households", index: "CREATE INDEX idx_households_barangay_number ON households (barangay_id, household_number)" },
    { name: "household_members", index: "CREATE INDEX idx_household_members_barangay_household ON household_members (barangay_id, household_id)" },
    { name: "document_requests", index: "CREATE INDEX idx_docreq_barangay_status ON document_requests (barangay_id, status)" },
    { name: "blotter_records", index: "CREATE INDEX idx_blotter_barangay_status ON blotter_records (barangay_id, status)" },
    { name: "activity_logs", index: "CREATE INDEX idx_activity_barangay_created ON activity_logs (barangay_id, created)" },
    { name: "visitor_logs", index: "CREATE INDEX idx_visitor_barangay_time_in ON visitor_logs (barangay_id, time_in)" },
    { name: "calendar_events", index: "CREATE INDEX idx_calendar_barangay_start ON calendar_events (barangay_id, start_datetime)" },
    { name: "deceased_records", index: "CREATE INDEX idx_deceased_barangay ON deceased_records (barangay_id)" },
    { name: "migrant_info", index: "CREATE INDEX idx_migrant_barangay_household ON migrant_info (barangay_id, household_id)" },
  ];

  for (const spec of specs) {
    const coll = app.findCollectionByNameOrId(spec.name);
    const idxName = spec.index.match(/INDEX (\w+)/)[1];
    const hasIdx = (coll.indexes || []).some((i) => i.includes(idxName));
    if (hasIdx) {
      console.log(`${spec.name}: ${idxName} already exists, skipping`);
      continue;
    }
    coll.indexes = [...(coll.indexes || []), spec.index];
    app.save(coll);
    console.log(`${spec.name}: ${idxName} added`);
  }
});
