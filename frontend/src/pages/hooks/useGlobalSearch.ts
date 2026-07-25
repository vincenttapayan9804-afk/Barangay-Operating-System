import { useState, useEffect, useRef } from 'react'
import { getClient } from '@/api/client'
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

function buildFilter(fields: string[], q: string): string {
  const terms = q.trim().split(/\s+/).filter(Boolean)
  return fields.map((f) => terms.map((t) => `${f} ~ "${t}"`).join(' && ')).join(' || ')
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

      const groupResults = await Promise.all(
        accessible.map(async (col) => {
          const label = t(col.labelKey)
          try {
            const filter = buildFilter(col.searchFields, q)
            const needed = [col.titleField, col.subtitleField].filter(Boolean)
            const list = await getClient().collection(col.name).getList(1, 5, {
              filter,
              sort: '-updated',
              fields: ['id', ...needed].join(','),
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
          } catch {
            return { label, link: col.link, items: [] }
          }
        }),
      )

      setResults(groupResults.filter((g) => g.items.length > 0))
      setSearching(false)
      setHasSearched(true)
    }, DEBOUNCE_MS)
  }, [query])

  return { query, setQuery, results, searching, hasSearched }
}
