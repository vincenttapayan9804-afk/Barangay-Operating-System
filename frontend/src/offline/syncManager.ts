import { getClient } from '@/api/client'
import { getSupabase } from '@/lib/supabaseClient'
import { isDemoModeEnabled } from '@/lib/demoAccounts'
import { peekAll, dequeue } from './queue'
import { verifyAuth } from '@/auth/session'

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'complete'

type SyncListener = (status: SyncStatus, remaining: number) => void

let listeners: SyncListener[] = []
let currentStatus: SyncStatus = 'idle'
let remainingCount = 0

function notify() {
  listeners.forEach((l) => l(currentStatus, remainingCount))
}

export function onSyncStatusChange(listener: SyncListener): () => void {
  listeners.push(listener)
  listener(currentStatus, remainingCount)
  return () => {
    listeners = listeners.filter((l) => l !== listener)
  }
}

export async function flushQueue(): Promise<void> {
  const items = await peekAll()
  if (items.length === 0) {
    currentStatus = 'idle'
    remainingCount = 0
    notify()
    return
  }

  const sessionValid = await verifyAuth()
  if (!sessionValid) {
    currentStatus = 'error'
    notify()
    return
  }

  currentStatus = 'syncing'
  remainingCount = items.length
  notify()

  for (const item of items) {
    try {
      if (isDemoModeEnabled()) {
        const pb = getClient()
        switch (item.method) {
          case 'create':
            await pb.collection(item.collection).create(item.payload)
            break
          case 'update':
            await pb.collection(item.collection).update(item.recordId!, item.payload)
            break
          case 'delete':
            await pb.collection(item.collection).delete(item.recordId!)
            break
        }
      } else {
        const supabase = getSupabase()
        switch (item.method) {
          case 'create': {
            const { error } = await supabase.from(item.collection).insert(item.payload)
            if (error) throw error
            break
          }
          case 'update': {
            const { error } = await supabase.from(item.collection).update(item.payload).eq('id', item.recordId!)
            if (error) throw error
            break
          }
          case 'delete': {
            const { error } = await supabase.from(item.collection).delete().eq('id', item.recordId!)
            if (error) throw error
            break
          }
        }
      }
      await dequeue(item.id!)
      remainingCount--
      notify()
    } catch {
      currentStatus = 'error'
      notify()
      return
    }
  }

  currentStatus = 'idle'
  remainingCount = 0
  notify()
}
