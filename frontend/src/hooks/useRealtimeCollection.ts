import { useEffect, useRef } from 'react'
import { getClient } from '@/api/client'

// Debounced so a burst of events (e.g. someone else bulk-editing) triggers
// one refetch instead of one per record.
const DEBOUNCE_MS = 400

/**
 * Subscribes to realtime create/update/delete events on a PocketBase
 * collection and calls `onChange` (debounced) whenever one arrives — the
 * simplest correct way to keep a shared list (blotter queue, document
 * queue, visitor log) live across multiple staff sessions without
 * reimplementing incremental merge logic. `onChange` is expected to be the
 * same full-refetch function the page already calls on mount.
 *
 * PocketBase enforces the collection's own API rules on realtime events too,
 * so a subscriber only ever receives events for records it could already
 * list/view — tenant isolation and role scoping apply automatically.
 */
export function useRealtimeCollection(collectionName: string, onChange: () => void) {
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    let unsubscribe: (() => void) | undefined
    let cancelled = false
    let debounceTimer: ReturnType<typeof setTimeout> | undefined

    getClient()
      .collection(collectionName)
      .subscribe('*', () => {
        if (debounceTimer) clearTimeout(debounceTimer)
        debounceTimer = setTimeout(() => onChangeRef.current(), DEBOUNCE_MS)
      })
      .then((unsub) => {
        if (cancelled) {
          unsub()
          return
        }
        unsubscribe = unsub
      })
      .catch(() => {
        // Realtime unavailable (demo mode, SSE blocked by a proxy, etc.) —
        // the page still works from its initial fetch, it just won't live-update.
      })

    return () => {
      cancelled = true
      if (debounceTimer) clearTimeout(debounceTimer)
      unsubscribe?.()
    }
  }, [collectionName])
}
