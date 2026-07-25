import type { RecordModel } from 'pocketbase'
import { getClient } from './client'
import { handleApiError } from './errorHandler'

export interface Barangay extends RecordModel {
  name: string
  municipality_city?: string
  province?: string
  region?: string
  active: boolean
}

const BARANGAYS = 'barangays'
const USERS = 'users'

export async function listBarangays(): Promise<Barangay[]> {
  try {
    // Exclude the internal "Platform Operations" pseudo-tenant (seeded by
    // 1785000028_platform_admin.js to hold platform-ops accounts) — it's
    // not a real barangay and shouldn't clutter the onboarding list.
    return await getClient()
      .collection(BARANGAYS)
      .getFullList<Barangay>({ sort: 'name', filter: 'name != "Platform Operations"' })
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
    return await getClient()
      .collection(BARANGAYS)
      .create<Barangay>({ ...data, active: true })
  } catch (err) {
    throw handleApiError(err)
  }
}

export async function setBarangayActive(id: string, active: boolean): Promise<void> {
  try {
    await getClient().collection(BARANGAYS).update(id, { active })
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
  } catch (err) {
    throw handleApiError(err)
  }
}
