import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { getApiUrl } from './apiConfig'

let client: SupabaseClient | null = null

// The real (non-demo) backend from here on — Kong's gateway URL plus the
// anon key, same singleton-on-first-use pattern api/client.ts's old
// PocketBase instance used, since the URL is only resolved once at boot
// (see apiConfig.ts's resolveApiUrl(), called from App.tsx before anything
// else touches the network).
export function getSupabase(): SupabaseClient {
  if (!client) {
    client = createClient(getApiUrl(), import.meta.env.VITE_SUPABASE_ANON_KEY ?? '', {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    })
  }
  return client
}
