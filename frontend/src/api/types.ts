// Replaces `RecordModel` (from the `pocketbase` package) as the base shape
// every `ApiXxx` interface extends. Real rows now come from PostgREST, which
// has no `collectionId`/`collectionName` concept — just the columns Phase 1
// mirrored PocketBase's field names onto 1:1, including `id`/`created`/
// `updated`. Demo mode's mock records (mockPocketBase.ts) carry the extra
// PocketBase-only fields too, which is fine — this is a minimum, not exact, shape.
export interface BaseRecord {
  id: string
  created: string
  updated: string
  // Mirrors RecordModel's own looseness (from the `pocketbase` package) —
  // several call sites read/write fields beyond what a given ApiXxx
  // interface declares (e.g. the shared `data_set` tag, generic CSV export
  // helpers), same as it did against the real PocketBase-typed record before.
  [key: string]: unknown
}
