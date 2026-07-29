import { getClient } from './client'
import { getSupabase } from '@/lib/supabaseClient'
import { isDemoModeEnabled } from '@/lib/demoAccounts'
import { handleApiError } from './errorHandler'
import { createActivity } from './activity'
import type { BaseRecord } from './types'

const COLLECTION = 'generated_government_forms'

export type GovFormAgency = 'coa' | 'bir' | 'dbm' | 'dole'

export interface GovernmentFormData {
  agency: GovFormAgency
  form_code: string
  title: string
  period_covered?: string
  input_data?: Record<string, unknown>
  supersedes_id?: string
}

export interface ApiGovernmentForm extends BaseRecord {
  agency: GovFormAgency
  form_code: string
  title: string
  period_covered: string
  input_data: Record<string, unknown>
  status: 'final' | 'void'
  supersedes_id: string | null
  generated_by: string | null
  chain_seq: number
  created: string
}

/**
 * Generates (inserts) a new government form record. This table is
 * immutable once written — the server-side hash-chain trigger
 * (0035_generated_government_forms.sql) stamps prev_hash/row_hash, and
 * there is no update/delete RLS policy. To correct a mistake, insert a
 * fresh record with `supersedes_id` pointing at the one being replaced
 * (see voidGovernmentForm below) rather than editing history.
 */
export async function createGovernmentForm(data: GovernmentFormData): Promise<ApiGovernmentForm> {
  try {
    let result: ApiGovernmentForm
    if (isDemoModeEnabled()) {
      result = await getClient().collection(COLLECTION).create<ApiGovernmentForm>(data)
    } else {
      const { data: row, error } = await getSupabase().from(COLLECTION).insert(data).select().single()
      if (error) throw error
      result = row as ApiGovernmentForm
    }
    createActivity('create', COLLECTION, result.id, `Generated ${result.agency.toUpperCase()} form: ${result.title}`)
    return result
  } catch (err) {
    throw handleApiError(err)
  }
}

/** Inserts a status='void' record referencing the original, without altering it. */
export async function voidGovernmentForm(original: ApiGovernmentForm, reason: string): Promise<ApiGovernmentForm> {
  return createGovernmentForm({
    agency: original.agency,
    form_code: original.form_code,
    title: `VOID — ${original.title}`,
    period_covered: original.period_covered,
    input_data: { voided_reason: reason, voided_form_id: original.id },
    supersedes_id: original.id,
  })
}

export async function getGovernmentForms(agency?: GovFormAgency): Promise<ApiGovernmentForm[]> {
  try {
    if (isDemoModeEnabled()) {
      const filter = agency ? getClient().filter('agency = {:a}', { a: agency }) : undefined
      return await getClient().collection(COLLECTION).getFullList<ApiGovernmentForm>({ sort: '-created', filter })
    }
    let q = getSupabase().from(COLLECTION).select('*')
    if (agency) q = q.eq('agency', agency)
    const { data, error } = await q.order('created', { ascending: false })
    if (error) throw error
    return data as ApiGovernmentForm[]
  } catch (err) {
    throw handleApiError(err)
  }
}

/** Admin-only: runs public.verify_government_form_chain and reports any broken links. */
export async function verifyGovernmentFormChain(barangayId: string): Promise<{ formId: string; valid: boolean }[]> {
  try {
    if (isDemoModeEnabled()) {
      // No real hash chain in browser-only demo mode — nothing to tamper-check against.
      return []
    }
    const { data, error } = await getSupabase().rpc('verify_government_form_chain', { p_barangay_id: barangayId })
    if (error) throw error
    return (data as { form_id: string; valid: boolean }[]).map((r) => ({ formId: r.form_id, valid: r.valid }))
  } catch (err) {
    throw handleApiError(err)
  }
}
