import { useState, useEffect, useRef } from 'react'
import { getClient } from '@/api/client'
import { getSupabase } from '@/lib/supabaseClient'
import { isDemoModeEnabled } from '@/lib/demoAccounts'
import { orIlike } from '@/api/supabaseFilters'
import { getCurrentUser, type Role } from '@/auth/session'
import { useTranslation, type TranslationKey } from '@/lib/i18n'

interface CollectionConfig {
  name: string
  labelKey: TranslationKey
  roles: Role[]
  searchFields: string[]
  titleField: string
  subtitleField: string
  link: string
}

const COLLECTIONS: CollectionConfig[] = [
  { name: 'residents', labelKey: 'search.collection.residents', roles: ['admin', 'staff', 'viewer'], searchFields: ['first_name', 'last_name'], titleField: 'last_name', subtitleField: 'first_name', link: '/residents' },
  { name: 'document_requests', labelKey: 'search.collection.documents', roles: ['admin', 'staff'], searchFields: ['resident_name', 'queue_number', 'document_type'], titleField: 'resident_name', subtitleField: 'document_type', link: '/documents' },
  { name: 'blotter_records', labelKey: 'search.collection.blotter', roles: ['admin', 'staff', 'viewer'], searchFields: ['complainant_name', 'respondent_name', 'case_number'], titleField: 'case_number', subtitleField: 'complainant_name', link: '/records' },
  { name: 'households', labelKey: 'search.collection.households', roles: ['admin', 'staff'], searchFields: ['household_name', 'household_number'], titleField: 'household_name', subtitleField: 'household_number', link: '/households' },
  { name: 'visitor_logs', labelKey: 'search.collection.visitorLog', roles: ['admin', 'staff'], searchFields: ['visitor_name', 'purpose'], titleField: 'visitor_name', subtitleField: 'purpose', link: '/logs/visitors' },
  { name: 'assets', labelKey: 'search.collection.assets', roles: ['admin'], searchFields: ['name', 'serial_number'], titleField: 'name', subtitleField: 'asset_type', link: '/assets' },
  { name: 'meetings', labelKey: 'search.collection.meetings', roles: ['admin', 'staff'], searchFields: ['title'], titleField: 'title', subtitleField: 'meeting_date', link: '/agenda' },
]

// The subset of COLLECTIONS that's also indexed in Meilisearch (see
// backend/supabase/functions/search-query + frontend/src/api/searchSync.ts)
// — everything else always goes through the direct table query path.
const MEILI_INDEXES = new Set(['residents', 'document_requests', 'blotter_records'])

export interface SearchResultItem {
  id: string
  collection: string
  collectionLabel: string
  title: string
  subtitle: string
  link: string
}

export interface SearchResultGroup {
  label: string
  link: string
  items: SearchResultItem[]
}

export interface UseGlobalSearchReturn {
  query: string
  setQuery: (q: string) => void
  results: SearchResultGroup[]
  searching: boolean
  hasSearched: boolean
}

const DEBOUNCE_MS = 300

async function searchViaTable(col: CollectionConfig, label: string, q: string): Promise<SearchResultGroup> {
  try {
    const needed = [col.titleField, col.subtitleField].filter(Boolean)
    const columns = Array.from(new Set(['id', ...needed]))

    if (isDemoModeEnabled()) {
      const filter = buildDemoFilter(col.searchFields, q)
      const list = await getClient().collection(col.name).getList(1, 5, {
        filter,
        sort: '-updated',
        fields: columns.join(','),
      })
      const items: SearchResultItem[] = list.items.map((record) => ({
        id: record.id,
        collection: col.name,
        collectionLabel: label,
        title: String(record[col.titleField] ?? ''),
        subtitle: String(record[col.subtitleField] ?? ''),
        link: col.link,
      }))
      return { label, link: col.link, items }
    }

    const { data, error } = await getSupabase()
      .from(col.name)
      .select(columns.join(','))
      .or(orIlike(col.searchFields, q))
      .order('updated', { ascending: false })
      .limit(5)
    if (error) throw error
    const items: SearchResultItem[] = (data as unknown as Record<string, unknown>[]).map((record) => ({
      id: record.id as string,
      collection: col.name,
      collectionLabel: label,
      title: String(record[col.titleField] ?? ''),
      subtitle: String(record[col.subtitleField] ?? ''),
      link: col.link,
    }))
    return { label, link: col.link, items }
  } catch {
    return { label, link: col.link, items: [] }
  }
}

function buildDemoFilter(fields: string[], q: string): string {
  const terms = q.trim().split(/\s+/).filter(Boolean)
  return fields.map((f) => terms.map((t) => `${f} ~ "${t.replace(/"/g, '\\"')}"`).join(' && ')).join(' || ')
}

interface MeiliHit {
  id: string
  first_name?: string
  last_name?: string
  resident_name?: string
  queue_number?: string
  document_type?: string
  case_number?: string
  complainant_name?: string
}

interface MeiliQueryResponse {
  results?: { indexUid: string; hits: MeiliHit[] }[]
  configured?: boolean
}

function hitToItem(indexName: string, hit: MeiliHit, label: string, link: string): SearchResultItem {
  if (indexName === 'residents') {
    return { id: hit.id, collection: indexName, collectionLabel: label, title: hit.last_name || '', subtitle: hit.first_name || '', link }
  }
  if (indexName === 'document_requests') {
    return { id: hit.id, collection: indexName, collectionLabel: label, title: hit.resident_name || '', subtitle: hit.document_type || '', link }
  }
  // blotter_records
  return { id: hit.id, collection: indexName, collectionLabel: label, title: hit.case_number || '', subtitle: hit.complainant_name || '', link }
}

/**
 * Tries the Meilisearch-backed proxy first (fuzzy, typo-tolerant, see
 * backend/supabase/functions/search-query) for the indexed collections.
 * Returns null (not an empty result) when the proxy reports it isn't
 * configured for this deployment, so the caller can fall back to the direct
 * table query path instead of showing "no results" for a feature that's
 * simply not set up. Always null in demo mode — no Edge Functions there.
 */
async function searchViaMeilisearch(
  q: string,
  accessible: CollectionConfig[],
  labelByCollection: Map<string, string>,
): Promise<SearchResultGroup[] | null> {
  if (isDemoModeEnabled()) return null

  const indexes = accessible.filter((c) => MEILI_INDEXES.has(c.name)).map((c) => c.name)
  if (indexes.length === 0) return []

  try {
    const { data, error } = await getSupabase().functions.invoke<MeiliQueryResponse>('search-query', {
      body: { query: q, indexes },
    })
    if (error) return null
    if (data?.configured === false) return null

    return (data?.results || []).map((r) => {
      const col = accessible.find((c) => c.name === r.indexUid)
      const label = labelByCollection.get(r.indexUid) || r.indexUid
      const link = col?.link || '/'
      return {
        label,
        link,
        items: (r.hits || []).map((hit) => hitToItem(r.indexUid, hit, label, link)),
      }
    })
  } catch {
    return null
  }
}

export function useGlobalSearch(): UseGlobalSearchReturn {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResultGroup[]>([])
  const [searching, setSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)

    const q = query.trim()
    if (q.length < 2) {
      setResults([])
      setSearching(false)
      setHasSearched(false)
      return
    }

    setSearching(true)

    timer.current = setTimeout(async () => {
      const user = getCurrentUser()
      const role = user?.role ?? 'viewer'
      const accessible = COLLECTIONS.filter((c) => c.roles.includes(role))
      const labelByCollection = new Map(accessible.map((c) => [c.name, t(c.labelKey)]))

      const meiliResults = await searchViaMeilisearch(q, accessible, labelByCollection)
      const nonMeiliCollections = accessible.filter((c) => !MEILI_INDEXES.has(c.name))
      // meiliResults === null means the proxy isn't configured/reachable —
      // fall back to the direct table query path for every collection, not
      // just the ones Meilisearch would have covered.
      const tableCollections = meiliResults === null ? accessible : nonMeiliCollections

      const [tableGroups] = await Promise.all([
        Promise.all(tableCollections.map((col) => searchViaTable(col, labelByCollection.get(col.name)!, q))),
      ])

      const groupResults = [...(meiliResults ?? []), ...tableGroups]
      setResults(groupResults.filter((g) => g.items.length > 0))
      setSearching(false)
      setHasSearched(true)
    }, DEBOUNCE_MS)
  }, [query])

  return { query, setQuery, results, searching, hasSearched }
}
