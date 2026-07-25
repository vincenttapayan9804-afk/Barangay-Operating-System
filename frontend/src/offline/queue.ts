import { openDB, type IDBPDatabase } from 'idb'

interface QueueItem {
  id?: number
  collection: string
  method: 'create' | 'update' | 'delete'
  payload: Record<string, unknown>
  recordId?: string
  timestamp: number
}

const DB_NAME = 'barangayos-offline-queue'
const DB_VERSION = 1
const STORE_NAME = 'queue'

let dbPromise: Promise<IDBPDatabase> | null = null

function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, {
            keyPath: 'id',
            autoIncrement: true,
          })
        }
      },
    })
  }
  return dbPromise
}

export async function enqueue(item: Omit<QueueItem, 'id' | 'timestamp'>): Promise<void> {
  const db = await getDb()
  await db.add(STORE_NAME, { ...item, timestamp: Date.now() })
}

export async function dequeue(id: number): Promise<void> {
  const db = await getDb()
  await db.delete(STORE_NAME, id)
}

export async function peekAll(): Promise<QueueItem[]> {
  const db = await getDb()
  return db.getAll(STORE_NAME)
}

export async function queueSize(): Promise<number> {
  const db = await getDb()
  return db.count(STORE_NAME)
}
