import { getClient } from './client'
import { getSupabase } from '@/lib/supabaseClient'
import { isDemoModeEnabled } from '@/lib/demoAccounts'
import type { BaseRecord } from './types'

export interface LookupOption {
  label: string
  code?: string
}

export interface ApiLookup extends BaseRecord {
  group: string
  values: LookupOption[]
}

export async function getLookup(group: string): Promise<LookupOption[]> {
  try {
    if (isDemoModeEnabled()) {
      const r = await getClient().collection('lookups').getFirstListItem<ApiLookup>(
        getClient().filter('group = {:g}', { g: group }),
        { requestKey: `lk-${group}` },
      )
      return r.values || []
    }

    const { data, error } = await getSupabase().from('lookups').select('*').eq('group', group).maybeSingle()
    if (error) throw error
    return (data as ApiLookup | null)?.values || []
  } catch {
    return []
  }
}

export async function getAllLookups(): Promise<Record<string, LookupOption[]>> {
  if (isDemoModeEnabled()) {
    const all = await getClient().collection('lookups').getFullList<ApiLookup>({ requestKey: 'all-lookups' })
    const map: Record<string, LookupOption[]> = {}
    for (const item of all) map[item.group] = item.values
    return map
  }

  const { data, error } = await getSupabase().from('lookups').select('*')
  if (error) throw error
  const map: Record<string, LookupOption[]> = {}
  for (const item of (data as ApiLookup[]) ?? []) map[item.group] = item.values
  return map
}
