/// <reference path="../pb_data/types.d.ts" />

// Multi-tenant support: introduce a `barangays` collection as the tenant
// registry, add a `barangay_id` relation to every barangay-owned collection,
// and AND a tenant check into each collection's existing API rules so one
// barangay's data is never visible to another. `lookups` stays global
// (shared reference/dropdown data, not barangay-owned).

migrate((app) => {
  const existingNames = {};
  for (const c of app.findAllCollections()) existingNames[c.name] = true;

  // ---- 1. Create the `barangays` tenant registry ----
  let barangaysColl;
  if (!existingNames["barangays"]) {
    barangaysColl = new Collection();
    barangaysColl.name = "barangays";
    barangaysColl.type = "base";
    barangaysColl.listRule = barangaysColl.viewRule = "id = @request.auth.barangay_id";
    // Only the PocketBase superuser (bypasses rules) manages tenants.
    barangaysColl.createRule = null;
    barangaysColl.updateRule = null;
    barangaysColl.deleteRule = null;

    const nameField = new TextField();
    nameField.name = "name";
    nameField.required = true;
    nameField.max = 255;
    barangaysColl.fields.push(nameField);

    const municipalityField = new TextField();
    municipalityField.name = "municipality_city";
    municipalityField.required = false;
    municipalityField.max = 255;
    barangaysColl.fields.push(municipalityField);

    const provinceField = new TextField();
    provinceField.name = "province";
    provinceField.required = false;
    provinceField.max = 255;
    barangaysColl.fields.push(provinceField);

    const regionField = new TextField();
    regionField.name = "region";
    regionField.required = false;
    regionField.max = 255;
    barangaysColl.fields.push(regionField);

    const activeField = new BoolField();
    activeField.name = "active";
    activeField.required = false;
    barangaysColl.fields.push(activeField);

    app.save(barangaysColl);
    console.log("barangays: collection created");
  } else {
    barangaysColl = app.findCollectionByNameOrId("barangays");
    console.log("barangays: already exists, skipping creation");
  }

  // ---- 2. Add barangay_id + tenant-scoped rules to every tenant collection ----
  // role-only rule fragments (unchanged from the existing schema, wrapped in
  // parens where they contain `||` so precedence with the new `&&` is safe)
  const specs = [
    { name: "users",
      list: '@request.auth.role = "admin"',
      view: '(@request.auth.role = "admin" || @request.auth.id = id)',
      create: '@request.auth.role = "admin"',
      update: '@request.auth.role = "admin"',
      del: '@request.auth.role = "admin"' },
    { name: "system_settings",
      list: '@request.auth.role != ""',
      view: '@request.auth.role != ""',
      create: '@request.auth.role = "admin"',
      update: '@request.auth.role = "admin"',
      del: '@request.auth.role = "admin"' },
    { name: "households",
      list: '@request.auth.id != ""',
      view: '@request.auth.id != ""',
      create: '(@request.auth.role = "admin" || @request.auth.role = "staff")',
      update: '(@request.auth.role = "admin" || @request.auth.role = "staff")',
      del: '@request.auth.role = "admin"' },
    { name: "residents",
      list: '@request.auth.id != ""',
      view: '@request.auth.id != ""',
      create: '(@request.auth.role = "admin" || @request.auth.role = "staff")',
      update: '(@request.auth.role = "admin" || @request.auth.role = "staff")',
      del: '@request.auth.role = "admin"' },
    { name: "document_requests",
      list: '@request.auth.id != ""',
      view: '@request.auth.id != ""',
      create: '(@request.auth.role = "admin" || @request.auth.role = "staff")',
      update: '(@request.auth.role = "admin" || @request.auth.role = "staff")',
      del: '(@request.auth.role = "admin" || @request.auth.role = "staff")' },
    { name: "blotter_records",
      list: '@request.auth.id != ""',
      view: '@request.auth.id != ""',
      create: '(@request.auth.role = "admin" || @request.auth.role = "staff")',
      update: '(@request.auth.role = "admin" || (@request.auth.role = "staff" && @request.auth.id = created_by))',
      del: '@request.auth.role = "admin"' },
    { name: "activity_logs",
      list: '@request.auth.id != ""',
      view: '@request.auth.id != ""',
      create: '@request.auth.id != ""',
      update: null,
      del: '@request.auth.role = "admin"' },
    { name: "visitor_logs",
      list: '@request.auth.id != ""',
      view: '@request.auth.id != ""',
      create: '(@request.auth.role = "admin" || @request.auth.role = "staff")',
      update: '(@request.auth.role = "admin" || @request.auth.role = "staff")',
      del: '(@request.auth.role = "admin" || @request.auth.role = "staff")' },
    { name: "meetings",
      list: '(@request.auth.role = "admin" || @request.auth.role = "staff")',
      view: '(@request.auth.role = "admin" || @request.auth.role = "staff")',
      create: '(@request.auth.role = "admin" || @request.auth.role = "staff")',
      update: '(@request.auth.role = "admin" || @request.auth.role = "staff")',
      del: '(@request.auth.role = "admin" || @request.auth.role = "staff")' },
    { name: "agenda_items",
      list: '(@request.auth.role = "admin" || @request.auth.role = "staff")',
      view: '(@request.auth.role = "admin" || @request.auth.role = "staff")',
      create: '(@request.auth.role = "admin" || @request.auth.role = "staff")',
      update: '(@request.auth.role = "admin" || @request.auth.role = "staff")',
      del: '(@request.auth.role = "admin" || @request.auth.role = "staff")' },
    { name: "calendar_events",
      list: '@request.auth.id != ""',
      view: '@request.auth.id != ""',
      create: '(@request.auth.role = "admin" || @request.auth.role = "staff")',
      update: '(@request.auth.role = "admin" || @request.auth.role = "staff")',
      del: '(@request.auth.role = "admin" || @request.auth.role = "staff")' },
    { name: "assets",
      list: '@request.auth.role = "admin"',
      view: '@request.auth.role = "admin"',
      create: '@request.auth.role = "admin"',
      update: '@request.auth.role = "admin"',
      del: '@request.auth.role = "admin"' },
    { name: "fund_sources",
      list: '@request.auth.id != ""',
      view: '@request.auth.id != ""',
      create: '(@request.auth.role = "admin" || @request.auth.role = "staff")',
      update: '@request.auth.role = "admin"',
      del: '@request.auth.role = "admin"' },
    { name: "appropriations",
      list: '@request.auth.id != ""',
      view: '@request.auth.id != ""',
      create: '(@request.auth.role = "admin" || @request.auth.role = "staff")',
      update: '(@request.auth.role = "admin" || (@request.auth.role = "staff" && @request.auth.id = created_by))',
      del: '@request.auth.role = "admin"' },
    { name: "disbursements",
      list: '@request.auth.id != ""',
      view: '@request.auth.id != ""',
      create: '(@request.auth.role = "admin" || @request.auth.role = "staff")',
      update: '(@request.auth.role = "admin" || (@request.auth.role = "staff" && @request.auth.id = created_by))',
      del: '@request.auth.role = "admin"' },
    { name: "income_accounts",
      list: '@request.auth.id != ""',
      view: '@request.auth.id != ""',
      create: '(@request.auth.role = "admin" || @request.auth.role = "staff")',
      update: '(@request.auth.role = "admin" || (@request.auth.role = "staff" && @request.auth.id = created_by))',
      del: '@request.auth.role = "admin"' },
    { name: "revenues",
      list: '@request.auth.id != ""',
      view: '@request.auth.id != ""',
      create: '(@request.auth.role = "admin" || @request.auth.role = "staff")',
      update: '(@request.auth.role = "admin" || (@request.auth.role = "staff" && @request.auth.id = created_by))',
      del: '@request.auth.role = "admin"' },
    { name: "finance_audit_logs",
      list: '(@request.auth.role = "admin" || @request.auth.role = "staff")',
      view: '(@request.auth.role = "admin" || @request.auth.role = "staff")',
      create: '@request.auth.id != ""',
      update: null,
      del: null },
    { name: "household_members",
      list: '@request.auth.id != ""',
      view: '@request.auth.id != ""',
      create: '(@request.auth.role = "admin" || @request.auth.role = "staff")',
      update: '(@request.auth.role = "admin" || @request.auth.role = "staff")',
      del: '(@request.auth.role = "admin" || @request.auth.role = "staff")' },
    { name: "migrant_info",
      list: '@request.auth.id != ""',
      view: '@request.auth.id != ""',
      create: '(@request.auth.role = "admin" || @request.auth.role = "staff")',
      update: '(@request.auth.role = "admin" || @request.auth.role = "staff")',
      del: '(@request.auth.role = "admin" || @request.auth.role = "staff")' },
    { name: "deceased_records",
      list: '@request.auth.id != ""',
      view: '@request.auth.id != ""',
      create: '(@request.auth.role = "admin" || @request.auth.role = "staff")',
      update: '(@request.auth.role = "admin" || @request.auth.role = "staff")',
      del: '@request.auth.role = "admin"' },
  ];

  for (const spec of specs) {
    if (!existingNames[spec.name]) {
      console.log(`${spec.name}: collection not found, skipping`);
      continue;
    }
    const coll = app.findCollectionByNameOrId(spec.name);

    const hasBarangayId = coll.fields.some((f) => f.name === "barangay_id");
    if (!hasBarangayId) {
      const f = new RelationField();
      f.name = "barangay_id";
      f.collectionId = barangaysColl.id;
      f.required = true;
      f.maxSelect = 1;
      f.cascadeDelete = false; // tenant offboarding is a deliberate manual/scripted op, not a cascade
      coll.fields.push(f);
      console.log(`${spec.name}: barangay_id field added`);
    } else {
      console.log(`${spec.name}: barangay_id already exists, skipping field add`);
    }

    coll.listRule = `barangay_id = @request.auth.barangay_id && ${spec.list}`;
    coll.viewRule = `barangay_id = @request.auth.barangay_id && ${spec.view}`;
    coll.createRule = spec.create === null
      ? null
      : `@request.body.barangay_id = @request.auth.barangay_id && ${spec.create}`;
    coll.updateRule = spec.update === null ? null : `barangay_id = @request.auth.barangay_id && ${spec.update}`;
    coll.deleteRule = spec.del === null ? null : `barangay_id = @request.auth.barangay_id && ${spec.del}`;

    app.save(coll);
    console.log(`${spec.name}: tenant-scoped rules applied`);
  }

  // ---- 3. Composite unique index for system_settings (barangay_id, key) ----
  const settingsColl = app.findCollectionByNameOrId("system_settings");
  const idxName = "idx_system_settings_barangay_key";
  const hasIdx = (settingsColl.indexes || []).some((i) => i.includes(idxName));
  if (!hasIdx) {
    settingsColl.indexes = [
      ...(settingsColl.indexes || []),
      `CREATE UNIQUE INDEX ${idxName} ON system_settings (barangay_id, key)`,
    ];
    app.save(settingsColl);
    console.log("system_settings: composite unique index added");
  } else {
    console.log("system_settings: composite unique index already exists, skipping");
  }
});
