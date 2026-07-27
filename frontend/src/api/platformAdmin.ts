import { getClient } from './client'
import { getSupabase } from '@/lib/supabaseClient'
import { isDemoModeEnabled } from '@/lib/demoAccounts'
import { handleApiError } from './errorHandler'
import type { BaseRecord } from './types'

export interface Barangay extends BaseRecord {
  name: string
  municipality_city?: string
  province?: string
  region?: string
  active: boolean
  require_staff_mfa: boolean
}

const BARANGAYS = 'barangays'
const USERS = 'users'

export async function listBarangays(): Promise<Barangay[]> {
  try {
    // Exclude the internal "Platform Operations" pseudo-tenant (seeded by
    // migrations/0001_barangays.sql) — it's not a real barangay and
    // shouldn't clutter the onboarding list.
    if (isDemoModeEnabled()) {
      return await getClient()
        .collection(BARANGAYS)
        .getFullList<Barangay>({ sort: 'name', filter: 'name != "Platform Operations"' })
    }
    const { data, error } = await getSupabase()
      .from(BARANGAYS)
      .select('*')
      .neq('name', 'Platform Operations')
      .order('name')
    if (error) throw error
    return data as Barangay[]
  } catch (err) {
    throw handleApiError(err)
  }
}

export async function createBarangay(data: {
  name: string
  municipality_city?: string
  province?: string
  region?: string
}): Promise<Barangay> {
  try {
    if (isDemoModeEnabled()) {
      return await getClient().collection(BARANGAYS).create<Barangay>({ ...data, active: true })
    }
    const { data: row, error } = await getSupabase().from(BARANGAYS).insert({ ...data, active: true }).select().single()
    if (error) throw error
    return row as Barangay
  } catch (err) {
    throw handleApiError(err)
  }
}

export async function setBarangayActive(id: string, active: boolean): Promise<void> {
  try {
    if (isDemoModeEnabled()) {
      await getClient().collection(BARANGAYS).update(id, { active })
      return
    }
    const { error } = await getSupabase().from(BARANGAYS).update({ active }).eq('id', id)
    if (error) throw error
  } catch (err) {
    throw handleApiError(err)
  }
}

export async function setBarangayRequireStaffMfa(id: string, require_staff_mfa: boolean): Promise<void> {
  try {
    if (isDemoModeEnabled()) {
      await getClient().collection(BARANGAYS).update(id, { require_staff_mfa })
      return
    }
    const { error } = await getSupabase().from(BARANGAYS).update({ require_staff_mfa }).eq('id', id)
    if (error) throw error
  } catch (err) {
    throw handleApiError(err)
  }
}

export async function createBarangayAdmin(data: {
  barangay_id: string
  email: string
  password: string
  name?: string
}): Promise<void> {
  try {
    if (isDemoModeEnabled()) {
      await getClient()
        .collection(USERS)
        .create({
          email: data.email,
          password: data.password,
          passwordConfirm: data.password,
          role: 'admin',
          barangay_id: data.barangay_id,
          name: data.name,
        })
      return
    }

    // Creating an auth.users row requires the service_role key, which never
    // reaches the frontend — this proxies through a platform-admin-gated
    // Edge Function instead (see backend/supabase/functions/
    // create-barangay-admin), a capability PocketBase's users-collection
    // API rules gave for free that Supabase's stricter auth model doesn't.
    const { error } = await getSupabase().functions.invoke('create-barangay-admin', {
      body: {
        email: data.email,
        password: data.password,
        barangay_id: data.barangay_id,
        name: data.name,
      },
    })
    if (error) throw error
  } catch (err) {
    throw handleApiError(err)
  }
}
