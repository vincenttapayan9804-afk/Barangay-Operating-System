/// <reference path="../pb_data/types.d.ts" />

// PDF certificate generation needs a public way to verify a printed
// document is genuine — the whole point of the QR code printed on it. This
// adds:
//
// 1. `document_requests.barangay_name` — a denormalized snapshot of the
//    issuing barangay's display name (from system_settings, set at request
//    creation time by the frontend), same pattern this collection already
//    uses for `resident_name`. Needed because the public verification page
//    is unauthenticated and can't read system_settings (which stays
//    tenant-scoped, unlike this one field).
//
// 2. `document_requests.viewRule` gains a narrow public OR-branch:
//    `status = "released"`. This is a view-by-id rule, not a list rule —
//    listRule is untouched, so released documents are still not
//    enumerable/browsable by anyone, tenant or public. Only someone who
//    already has the exact 15-char record id (from the printed QR code)
//    can look it up, and only once it's actually been released (pending/
//    processing/cancelled requests, which carry internal workflow state
//    like `notes`, stay fully private). This is the same "unlisted link"
//    trust model used by most real-world document verification portals.

migrate((app) => {
  const docsColl = app.findCollectionByNameOrId("document_requests");

  const hasField = docsColl.fields.some((f) => f.name === "barangay_name");
  if (!hasField) {
    const barangayNameField = new TextField();
    barangayNameField.name = "barangay_name";
    barangayNameField.required = false;
    barangayNameField.max = 255;
    docsColl.fields.push(barangayNameField);
    console.log("document_requests: barangay_name field added");
  } else {
    console.log("document_requests: barangay_name field already exists, skipping");
  }

  const currentView = docsColl.viewRule || "";
  if (!currentView.includes('status = "released"')) {
    docsColl.viewRule = `(${currentView}) || status = "released"`;
    console.log("document_requests: viewRule now allows public view of released documents");
  } else {
    console.log("document_requests: viewRule already allows public view, skipping");
  }

  app.save(docsColl);

  // Best-effort backfill for any documents created before this migration —
  // the live deployment has no real tenants onboarded yet, so this is
  // mostly a no-op safety net for local/dev databases with test data.
  let backfilled = 0;
  const staleDocs = app.findRecordsByFilter("document_requests", 'barangay_name = ""', "", 0, 0);
  for (const doc of staleDocs) {
    try {
      const settingsForTenant = app.findRecordsByFilter(
        "system_settings",
        `barangay_id = "${doc.get("barangay_id")}" && key = "barangay_name"`,
        "",
        1,
        0,
      );
      const name = settingsForTenant.length > 0 ? settingsForTenant[0].get("value") : "";
      if (name) {
        doc.set("barangay_name", typeof name === "string" ? name : JSON.stringify(name));
        app.save(doc);
        backfilled++;
      }
    } catch {
      // No configured barangay_name for this tenant yet — leave blank,
      // the verify page just omits the line rather than erroring.
    }
  }
  console.log(`document_requests: ${backfilled} existing record(s) backfilled with barangay_name`);
});
