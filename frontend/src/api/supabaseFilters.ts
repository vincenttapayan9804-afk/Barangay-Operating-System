// Shared helpers for building safe PostgREST `.or()` filter strings — the
// single point of correctness for what used to be several separate
// hand-built (and in searchHouseholds()'s case, entirely unescaped)
// PocketBase filter-string templates in households.ts/lookups.ts/
// settings.ts/platformAdmin.ts/useGlobalSearch.ts. PostgREST's or() syntax
// treats `,`, `.`, `(`, `)` and `"` specially, so any value that reaches it
// must be quoted and escaped the same way every time, not re-derived per
// call site.

function quoteFilterValue(value: string): string {
  return `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

/** Builds a `column.ilike."%term%"` clause, safe to hand to `.or()` or `.ilike()`. */
export function ilikeTerm(term: string): string {
  return quoteFilterValue(`%${term}%`)
}

/** Builds an `.or()`-ready string matching `term` (case-insensitive, substring) across any of `fields`. */
export function orIlike(fields: string[], term: string): string {
  const needle = ilikeTerm(term)
  return fields.map((f) => `${f}.ilike.${needle}`).join(',')
}

/** Builds an `.or()`-ready string requiring an exact match on `field` against one of `values`. */
export function orEq(field: string, values: string[]): string {
  return values.map((v) => `${field}.eq.${quoteFilterValue(v)}`).join(',')
}
