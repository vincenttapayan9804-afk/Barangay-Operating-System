import { useEffect, useRef } from 'react'
import { getSupabase } from '@/lib/supabaseClient'
import { isDemoModeEnabled } from '@/lib/demoAccounts'

// Debounced so a burst of events (e.g. someone else bulk-editing) triggers
// one refetch instead of one per record.
const DEBOUNCE_MS = 400

/**
 * Subscribes to realtime create/update/delete events on a table (demo mode:
 * a PocketBase-shaped collection) and calls `onChange` (debounced) whenever
 * one arrives — the simplest correct way to keep a shared list (blotter
 * queue, document queue, visitor log) live across multiple staff sessions
 * without reimplementing incremental merge logic. `onChange` is expected to
 * be the same full-refetch function the page already calls on mount.
 *
 * Real backend: Supabase Realtime's `postgres_changes` respects RLS on the
 * underlying table (confirmed in Phase 0's spike), so a subscriber only
 * ever receives events for rows it could already select — tenant isolation
 * and role scoping apply automatically, same guarantee PocketBase's own API
 * rules gave realtime events.
 */
export function useRealtimeCollection(collectionName: string, onChange: () => void) {
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout> | undefined
    const trigger = () => {
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => onChangeRef.current(), DEBOUNCE_MS)
    }

    if (isDemoModeEnabled()) {
      // mockPocketBase.ts's subscribe() is an intentional no-op (demo mode
      // has no server pushing events) — nothing to actually subscribe to.
      return () => {
        if (debounceTimer) clearTimeout(debounceTimer)
      }
    }

    const supabase = getSupabase()
    const channel = supabase
      .channel(`realtime:${collectionName}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: collectionName }, trigger)
      .subscribe()

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer)
      void supabase.removeChannel(channel)
    }
  }, [collectionName])
}
