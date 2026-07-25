/// <reference path="../pb_data/types.d.ts" />

// Full-text search proxy for Meilisearch (residents, document_requests,
// blotter_records). The frontend never talks to Meilisearch directly and
// never sees a Meilisearch API key — every index write and every search
// query goes through these two authenticated routes, which force
// `barangay_id` from the trusted server-side session (e.auth), never from
// client-supplied data. This is deliberately simpler than Meilisearch's
// tenant-token (JWT) mechanism: no token minting/expiry to get wrong, and
// tenant scoping can't be bypassed by a modified frontend since the filter
// is built here, not passed in.
//
// Three things verified empirically against a real PocketBase 0.39.5 +
// Meilisearch 1.10 instance, none obvious from the docs:
//
// 1. Same self-contained-handler constraint as notify.pb.js — a routerAdd
//    callback can't reference a top-level const/function. Nothing here
//    does. Top-level code (the index-setup IIFE below) is a different
//    story and runs fine in normal script scope.
//
// 2. e.bindBody(data) must be called before e.auth is accessed in the same
//    handler, not after — reading e.auth first leaves the request body
//    unreadable by the time bindBody runs (every field silently binds to
//    its zero value). Every handler below calls bindBody first.
//
// 3. A DynamicModel field declared with an object shape (e.g. `document:
//    {}`) does NOT bind to a plain JS object — it binds to a Go-backed
//    map wrapper whose fields are only reachable via .get()/.set(), not
//    dot/bracket access (`data.document.id` silently reads as undefined
//    even though the field is really there — confirmed by JSON.stringify
//    showing it correctly). Round-tripping through
//    JSON.parse(JSON.stringify(...)) turns it into a real plain object,
//    which is what every handler below does before touching it normally.
//
// Requires MEILI_URL and MEILI_MASTER_KEY env vars (see docker-compose.yml
// and docs/DEPLOYMENT.md "Full-text search (Meilisearch)"). No-ops with a
// clear response if unset — search is an enhancement, not a hard
// dependency, so a deployment without it configured just falls back to the
// existing PocketBase-query-based search on the frontend.

// One-time-per-boot index setup. Two things every index needs before the
// routes below will actually work, discovered the hard way against a real
// Meilisearch instance:
//
// - An explicit primaryKey. Every indexed document has both `id` and
//   `barangay_id` — two fields ending in "id" — so Meilisearch's
//   auto-inference on first write refuses to guess and the write silently
//   fails (task status "failed", but the /api/search/index route still
//   returns {success:true} since the enqueue itself succeeds). Creating
//   the index with primaryKey="id" up front avoids ever hitting inference.
// - filterable-attributes including barangay_id, since every query/write
//   below filters or forces it.
//
// Both calls are safe to repeat — creating an already-existing index and
// PUT-ing the same settings are no-ops past the first boot.
(function setupSearchIndexes() {
  const meiliUrl = $os.getenv("MEILI_URL");
  const meiliKey = $os.getenv("MEILI_MASTER_KEY");
  if (!meiliUrl) return;

  const indexes = ["residents", "document_requests", "blotter_records"];
  for (let i = 0; i < indexes.length; i++) {
    try {
      $http.send({
        method: "POST",
        url: meiliUrl + "/indexes",
        headers: { "Authorization": "Bearer " + meiliKey, "Content-Type": "application/json" },
        body: JSON.stringify({ uid: indexes[i], primaryKey: "id" }),
      });
      $http.send({
        method: "PUT",
        url: meiliUrl + "/indexes/" + indexes[i] + "/settings/filterable-attributes",
        headers: { "Authorization": "Bearer " + meiliKey, "Content-Type": "application/json" },
        body: JSON.stringify(["barangay_id"]),
      });
    } catch (err) {
      console.log("search: failed to configure index " + indexes[i] + ": " + err);
    }
  }
})();

routerAdd("POST", "/api/search/index", (e) => {
  const data = new DynamicModel({
    index: "",
    action: "",
    document: {},
  });
  e.bindBody(data);

  if (!e.auth) {
    throw new UnauthorizedError("Authentication required.");
  }
  const barangayId = e.auth.get("barangay_id");
  if (!barangayId) {
    throw new BadRequestError("No barangay_id on the authenticated account.");
  }

  const allowedIndexes = ["residents", "document_requests", "blotter_records"];
  if (allowedIndexes.indexOf(data.index) === -1) {
    throw new BadRequestError("Invalid search index.");
  }

  const doc = JSON.parse(JSON.stringify(data.document || {}));
  if (!doc.id) {
    throw new BadRequestError("Missing document id.");
  }

  const meiliUrl = $os.getenv("MEILI_URL");
  const meiliKey = $os.getenv("MEILI_MASTER_KEY");
  if (!meiliUrl) {
    return e.json(200, { success: false, reason: "search not configured" });
  }

  if (data.action === "delete") {
    $http.send({
      method: "DELETE",
      url: meiliUrl + "/indexes/" + data.index + "/documents/" + encodeURIComponent(doc.id),
      headers: { "Authorization": "Bearer " + meiliKey },
    });
  } else {
    // Trust the session's barangay_id, not whatever the client sent — this
    // is the one line that actually prevents a compromised/buggy frontend
    // from indexing data under another tenant.
    doc.barangay_id = barangayId;
    $http.send({
      method: "POST",
      url: meiliUrl + "/indexes/" + data.index + "/documents",
      headers: { "Authorization": "Bearer " + meiliKey, "Content-Type": "application/json" },
      body: JSON.stringify([doc]),
    });
  }

  return e.json(200, { success: true });
}, $apis.requireAuth());

routerAdd("POST", "/api/search/query", (e) => {
  const data = new DynamicModel({
    query: "",
    indexes: [],
  });
  e.bindBody(data);

  if (!e.auth) {
    throw new UnauthorizedError("Authentication required.");
  }
  const barangayId = e.auth.get("barangay_id");
  const role = e.auth.get("role");
  if (!barangayId) {
    return e.json(200, { results: [] });
  }

  const q = (data.query || "").trim();
  if (q.length < 2) {
    return e.json(200, { results: [] });
  }

  // Same per-role visibility as the rest of the app: viewers can read
  // residents/blotter but not the document queue.
  const rolesByIndex = {
    residents: ["admin", "staff", "viewer"],
    document_requests: ["admin", "staff"],
    blotter_records: ["admin", "staff", "viewer"],
  };

  const meiliUrl = $os.getenv("MEILI_URL");
  const meiliKey = $os.getenv("MEILI_MASTER_KEY");
  if (!meiliUrl) {
    return e.json(200, { results: [], configured: false });
  }

  const safeBarangayId = String(barangayId).replace(/"/g, "");
  const requestedIndexes = JSON.parse(JSON.stringify(data.indexes || []));
  const queries = [];
  for (let i = 0; i < requestedIndexes.length; i++) {
    const idx = requestedIndexes[i];
    const allowedRoles = rolesByIndex[idx];
    if (!allowedRoles || allowedRoles.indexOf(role) === -1) continue;
    queries.push({
      indexUid: idx,
      q: q,
      filter: 'barangay_id = "' + safeBarangayId + '"',
      limit: 5,
    });
  }

  if (queries.length === 0) {
    return e.json(200, { results: [] });
  }

  const res = $http.send({
    method: "POST",
    url: meiliUrl + "/multi-search",
    headers: { "Authorization": "Bearer " + meiliKey, "Content-Type": "application/json" },
    body: JSON.stringify({ queries: queries }),
  });

  return e.json(200, res.json || { results: [] });
}, $apis.requireAuth());
