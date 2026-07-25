// One-time bootstrap for demo mode: creates the demo barangay tenant, the
// three canned demo accounts, a handful of system settings, and a full set
// of realistic sample records — all through the normal api/*.ts helpers, so
// it exercises exactly the same code paths a real deployment would.
import { getClient } from '@/api/client'
import { withBatch } from '@/api/mockPocketBase'
import { DEMO_ACCOUNTS, DEMO_BARANGAY_ID, isDemoSeeded, markDemoSeeded } from '@/lib/demoAccounts'
import { AVAILABLE_COLLECTIONS, seedCollections } from '@/features/settings/demoData'

export async function ensureDemoSeeded(onProgress?: (msg: string) => void): Promise<void> {
  if (isDemoSeeded()) return

  await withBatch(async () => {
    const client = getClient()

    onProgress?.('Setting up your demo barangay...')
    await client.collection('barangays').create({
      id: DEMO_BARANGAY_ID,
      name: 'Barangay Poblacion',
      municipality_city: 'Quezon City',
      province: 'Metro Manila',
      region: 'NCR',
      active: true,
    })

    for (const account of DEMO_ACCOUNTS) {
      await client.collection('users').create({
        id: `demo_${account.role}_user`,
        email: account.email,
        password: account.password,
        role: account.role,
        name: account.name,
        barangay_id: DEMO_BARANGAY_ID,
        is_platform_admin: false,
      })
    }

    const settings: [string, unknown][] = [
      ['barangay_name', 'Poblacion'],
      ['municipality_city', 'Quezon City'],
      ['province', 'Metro Manila'],
      ['region', 'NCR'],
    ]
    for (const [key, value] of settings) {
      await client.collection('system_settings').create({ key, value, barangay_id: DEMO_BARANGAY_ID })
    }

    onProgress?.('Generating sample records...')
    const result = await seedCollections(
      AVAILABLE_COLLECTIONS.map((c) => c.id),
      (msg) => onProgress?.(msg),
    )
    if (result.errors.length > 0) {
      console.warn(`Demo seeding finished with ${result.errors.length} non-fatal errors:`, result.errors)
    }
  })

  markDemoSeeded()
}
