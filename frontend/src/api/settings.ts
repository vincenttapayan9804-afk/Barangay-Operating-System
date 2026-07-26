import { getClient } from './client'
import { getSupabase } from '@/lib/supabaseClient'
import { isDemoModeEnabled } from '@/lib/demoAccounts'
import { handleApiError } from './errorHandler'
import type { BaseRecord } from './types'

export interface ApiSetting extends BaseRecord {
  key: string
  value: any
}

const COLLECTION = 'system_settings'

export async function getAllSettings(): Promise<Record<string, any>> {
  try {
    const records = await getAllSettingsRecords()
    const settings: Record<string, any> = {}
    for (const record of records) settings[record.key] = record.value
    return settings
  } catch (err) {
    throw handleApiError(err)
  }
}

/** Same rows as getAllSettings(), unflattened — callers that also need each row's `id` (to target updateSetting()) use this instead. */
export async function getAllSettingsRecords(): Promise<ApiSetting[]> {
  try {
    if (isDemoModeEnabled()) {
      return await getClient().collection(COLLECTION).getFullList<ApiSetting>()
    }
    const { data, error } = await getSupabase().from(COLLECTION).select('*')
    if (error) throw error
    return data as ApiSetting[]
  } catch (err) {
    throw handleApiError(err)
  }
}

export async function getSetting(key: string): Promise<any | null> {
  try {
    if (isDemoModeEnabled()) {
      const record = await getClient().collection(COLLECTION).getFirstListItem<ApiSetting>(
        getClient().filter('key = {:k}', { k: key }),
        { $autoCancel: false },
      )
      return record.value
    }
    const { data, error } = await getSupabase().from(COLLECTION).select('*').eq('key', key).maybeSingle()
    if (error) throw error
    return (data as ApiSetting | null)?.value ?? null
  } catch {
    return null
  }
}

export async function updateSetting(id: string, _key: string, value: any): Promise<void> {
  try {
    if (isDemoModeEnabled()) {
      await getClient().collection(COLLECTION).update(id, { value })
      return
    }
    const { error } = await getSupabase().from(COLLECTION).update({ value }).eq('id', id)
    if (error) throw error
  } catch (err) {
    throw handleApiError(err)
  }
}

export async function upsertSetting(key: string, value: any): Promise<ApiSetting> {
  try {
    if (isDemoModeEnabled()) {
      const existing = await getClient().collection(COLLECTION).getFirstListItem<ApiSetting>(
        getClient().filter('key = {:k}', { k: key }),
        { $autoCancel: false },
      ).catch(() => null)

      if (existing) {
        return await getClient().collection(COLLECTION).update(existing.id, { value })
      }
      return await getClient().collection(COLLECTION).create({ key, value })
    }

    const { data: existing } = await getSupabase().from(COLLECTION).select('*').eq('key', key).maybeSingle()
    if (existing) {
      const { data, error } = await getSupabase().from(COLLECTION).update({ value }).eq('id', (existing as ApiSetting).id).select().single()
      if (error) throw error
      return data as ApiSetting
    }
    const { data, error } = await getSupabase().from(COLLECTION).insert({ key, value }).select().single()
    if (error) throw error
    return data as ApiSetting
  } catch (err) {
    throw handleApiError(err)
  }
}

export interface DocumentFees {
  barangay_clearance: number
  business_permit: number
  certificate_of_indigency: number
  certificate_of_residency: number
  certificate_of_good_moral: number
  cedula: number
  other: number
}

export interface ComplianceWarningItem {
  type: string
  fund_source?: string
  code?: string
  required?: number
  actual?: number
  shortfall?: number
  ps_total?: number
  cap?: number
  excess?: number
}

export interface ComplianceWarnings {
  [fiscalYear: string]: ComplianceWarningItem[]
}

export interface FinanceConfig {
  default_income_account: string
  default_fund_source: string
  auto_create_revenue_on_payment: boolean
  current_fiscal_year: number
  preceding_year_income: number
  complianceWarnings: ComplianceWarnings
  document_fees: DocumentFees
}

// Note: the pre-migration PocketBase version of this read `record.get("finance_config")`
// off the system_settings row keyed "barangay_config" — but that collection's only
// value-carrying field is `value`, so that call always returned undefined (a
// pre-existing, silent no-op bug). Fixed here to actually read/write `value`,
// which is what upsertSetting('barangay_config', ...) would have written to
// begin with — this is the first version where finance config persistence works.
export async function getFinanceConfig(): Promise<FinanceConfig | null> {
  try {
    return (await getSetting('barangay_config')) as FinanceConfig | null
  } catch {
    return null
  }
}

export async function updateFinanceConfig(config: FinanceConfig): Promise<void> {
  try {
    await upsertSetting('barangay_config', config)
  } catch (e) {
    throw handleApiError(e)
  }
}
