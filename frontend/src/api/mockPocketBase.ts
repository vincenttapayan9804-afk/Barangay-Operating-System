// A minimal, in-browser stand-in for the PocketBase JS SDK client, used only
// when demo mode is active (see lib/demoAccounts.ts). It implements the
// subset of the real `PocketBase` client surface this app actually calls —
// collection()/getList/getFullList/getOne/getFirstListItem/create/update/
// delete, filter(), and users' authWithPassword/authRefresh — backed by
// plain arrays persisted to localStorage instead of HTTP requests. This lets
// every existing api/*.ts helper run completely unmodified against fake
// data, entirely offline, with no server anywhere.
import { ClientResponseError } from 'pocketbase'
import { DEMO_BARANGAY_ID } from '@/lib/demoAccounts'

type Rec = Record<string, any>
type Db = Record<string, Rec[]>

const DB_KEY = 'clustr_demo_db_v1'
const AUTH_KEY = 'clustr_demo_auth_v1'

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

let db: Db | null = null
let batchDepth = 0

function loadDb(): Db {
  if (db) return db
  try {
    const raw = localStorage.getItem(DB_KEY)
    db = raw ? JSON.parse(raw) : {}
  } catch {
    db = {}
  }
  return db!
}

function persist(): void {
  if (batchDepth > 0) return
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(db))
  } catch {
    // storage full / unavailable — demo data just won't survive a reload
  }
}

/** Suppresses localStorage writes until the callback settles, then writes once. Used for bulk seeding. */
export async function withBatch<T>(fn: () => Promise<T>): Promise<T> {
  batchDepth++
  try {
    return await fn()
  } finally {
    batchDepth--
    if (batchDepth === 0) persist()
  }
}

function coll(name: string): Rec[] {
  const d = loadDb()
  if (!d[name]) d[name] = []
  return d[name]
}

let idCounter = 0
function genId(): string {
  idCounter++
  const t = Date.now().toString(36)
  const r = Math.random().toString(36).slice(2, 8)
  return `${t}${r}${idCounter.toString(36)}`.padEnd(15, '0').slice(0, 15)
}

function genToken(): string {
  return `demo.${genId()}.${genId()}`
}

function nowIso(): string {
  return new Date().toISOString()
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

function notFoundError(): ClientResponseError {
  return new ClientResponseError({
    status: 404,
    response: { message: "The requested resource wasn't found.", data: {} },
  })
}

function authError(message: string): ClientResponseError {
  return new ClientResponseError({ status: 400, response: { message, data: {} } })
}

// ---------------------------------------------------------------------------
// Filter parsing — a pragmatic subset of PocketBase's filter syntax, enough
// to evaluate every filter expression this app actually builds: `&&`/`||`
// combinators, single-level parens, and `=`, `!=`, `~`, `>`, `<`, `>=`, `<=`
// comparisons against quoted strings, numbers, or booleans.
// ---------------------------------------------------------------------------

function splitTopLevel(expr: string, op: '&&' | '||'): string[] {
  const parts: string[] = []
  let depth = 0
  let current = ''
  let i = 0
  while (i < expr.length) {
    const ch = expr[i]
    if (ch === '(') depth++
    if (ch === ')') depth--
    if (depth === 0 && expr.slice(i, i + op.length) === op) {
      parts.push(current)
      current = ''
      i += op.length
      continue
    }
    current += ch
    i++
  }
  parts.push(current)
  return parts.map((s) => s.trim()).filter(Boolean)
}

function stripOuterParens(expr: string): string {
  const s = expr.trim()
  if (!s.startsWith('(') || !s.endsWith(')')) return s
  let depth = 0
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '(') depth++
    else if (s[i] === ')') {
      depth--
      if (depth === 0 && i !== s.length - 1) return s // closes early — parens aren't wrapping the whole thing
    }
  }
  return s.slice(1, -1)
}

function parseValue(raw: string): unknown {
  const v = raw.trim()
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    return v.slice(1, -1).replace(/\\(.)/g, '$1')
  }
  if (v === 'true') return true
  if (v === 'false') return false
  if (v !== '' && !isNaN(Number(v))) return Number(v)
  return v
}

const COMPARE_OPS = ['!=', '>=', '<=', '~', '!~', '=', '>', '<'] as const

function looseEq(a: unknown, b: unknown): boolean {
  const av = a === undefined || a === null ? '' : a
  return String(av) === String(b)
}

function toComparable(v: unknown): number | string {
  if (typeof v === 'number') return v
  if (typeof v === 'string') {
    if (/^\d{4}-\d{2}-\d{2}/.test(v)) {
      const t = Date.parse(v)
      if (!isNaN(t)) return t
    }
    const n = Number(v)
    if (v !== '' && !isNaN(n)) return n
  }
  return v as string
}

function evalCond(record: Rec, cond: string): boolean {
  const c = cond.trim()
  if (!c) return true
  for (const op of COMPARE_OPS) {
    const idx = c.indexOf(op)
    if (idx === -1) continue
    const field = c.slice(0, idx).trim()
    const value = parseValue(c.slice(idx + op.length))
    const actual = record[field]
    switch (op) {
      case '~':
        return String(actual ?? '').toLowerCase().includes(String(value).toLowerCase())
      case '!~':
        return !String(actual ?? '').toLowerCase().includes(String(value).toLowerCase())
      case '!=':
        return !looseEq(actual, value)
      case '=':
        return looseEq(actual, value)
      case '>':
        return toComparable(actual) > toComparable(value)
      case '<':
        return toComparable(actual) < toComparable(value)
      case '>=':
        return toComparable(actual) >= toComparable(value)
      case '<=':
        return toComparable(actual) <= toComparable(value)
    }
  }
  return true
}

function evalExpr(record: Rec, expr: string): boolean {
  const trimmed = expr.trim()
  if (!trimmed) return true

  const andParts = splitTopLevel(trimmed, '&&')
  if (andParts.length > 1) return andParts.every((p) => evalExpr(record, p))

  const orParts = splitTopLevel(trimmed, '||')
  if (orParts.length > 1) return orParts.some((p) => evalExpr(record, p))

  const stripped = stripOuterParens(trimmed)
  if (stripped !== trimmed) return evalExpr(record, stripped)

  return evalCond(record, trimmed)
}

function matchesFilter(record: Rec, filter?: string): boolean {
  if (!filter || !filter.trim()) return true
  return evalExpr(record, filter)
}

function filterFn(raw: string, params?: Record<string, unknown>): string {
  if (!params) return raw
  return raw.replace(/\{:(\w+)\}/g, (_, key: string) => {
    const v = params[key]
    if (v === undefined || v === null) return "''"
    if (typeof v === 'number' || typeof v === 'boolean') return String(v)
    return `'${String(v).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
  })
}

function applySort(items: Rec[], sort?: string): Rec[] {
  if (!sort) return items
  const fields = sort
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  if (fields.length === 0) return items
  return [...items].sort((a, b) => {
    for (const f of fields) {
      const desc = f.startsWith('-')
      const key = desc ? f.slice(1) : f
      const av = a[key]
      const bv = b[key]
      let cmp: number
      if (av === bv) cmp = 0
      else if (av === undefined || av === null) cmp = -1
      else if (bv === undefined || bv === null) cmp = 1
      else if (typeof av === 'number' && typeof bv === 'number') cmp = av - bv
      else cmp = String(av).localeCompare(String(bv))
      if (desc) cmp = -cmp
      if (cmp !== 0) return cmp
    }
    return 0
  })
}

// Relation field -> target collection, for the `expand` option. Only the
// relations this app actually expands need to be listed here.
const EXPAND_MAP: Record<string, string> = {
  appropriation: 'appropriations',
  fund_source: 'fund_sources',
  income_account: 'income_accounts',
  document_request: 'document_requests',
}

function applyExpand<T extends Rec>(record: T, expand: string | undefined): T {
  if (!expand) return record
  const fields = expand
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const expanded: Rec = { ...(record.expand || {}) }
  let any = false
  for (const f of fields) {
    const targetCollection = EXPAND_MAP[f]
    const relId = record[f]
    if (!targetCollection || !relId) continue
    const found = coll(targetCollection).find((r) => r.id === relId)
    if (found) {
      expanded[f] = { ...found }
      any = true
    }
  }
  return any || record.expand ? { ...record, expand: expanded } : record
}

function sanitizeUser(rec: Rec): Rec {
  const { password: _password, ...rest } = rec
  return { ...rest }
}

// ---------------------------------------------------------------------------
// Auth store — mirrors the subset of PocketBase's BaseAuthStore this app uses
// ---------------------------------------------------------------------------

class MockAuthStore {
  token = ''
  record: Rec | null = null

  constructor() {
    try {
      const raw = localStorage.getItem(AUTH_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        this.token = parsed.token ?? ''
        this.record = parsed.record ?? null
      }
    } catch {
      // ignore corrupt/absent session
    }
  }

  get model(): Rec | null {
    return this.record
  }

  get isValid(): boolean {
    return !!this.token && !!this.record
  }

  get isSuperuser(): boolean {
    return false
  }

  save(token: string, record?: Rec | null): void {
    this.token = token
    this.record = record ?? null
    try {
      localStorage.setItem(AUTH_KEY, JSON.stringify({ token: this.token, record: this.record }))
    } catch {
      // ignore
    }
  }

  clear(): void {
    this.token = ''
    this.record = null
    try {
      localStorage.removeItem(AUTH_KEY)
    } catch {
      // ignore
    }
  }
}

// ---------------------------------------------------------------------------
// Record service — the object returned by `client.collection(name)`
// ---------------------------------------------------------------------------

interface QueryOptions {
  filter?: string
  sort?: string
  expand?: string
  perPage?: number
  [key: string]: unknown
}

function filterAndSort(name: string, options: QueryOptions): Rec[] {
  const items = coll(name).filter((r) => matchesFilter(r, options.filter))
  return applySort(items, options.sort)
}

function makeRecordService(name: string, authStore: MockAuthStore) {
  const base = {
    async getFullList<T = Rec>(options: QueryOptions = {}): Promise<T[]> {
      let items = filterAndSort(name, options)
      if (options.perPage) items = items.slice(0, options.perPage)
      const out = items.map((r) => applyExpand(name === 'users' ? sanitizeUser(r) : { ...r }, options.expand))
      return out as T[]
    },
    async getList<T = Rec>(
      page = 1,
      perPage = 30,
      options: QueryOptions = {},
    ): Promise<{ page: number; perPage: number; totalItems: number; totalPages: number; items: T[] }> {
      const all = filterAndSort(name, options)
      const totalItems = all.length
      const totalPages = Math.max(1, Math.ceil(totalItems / perPage))
      const start = (page - 1) * perPage
      const items = all
        .slice(start, start + perPage)
        .map((r) => applyExpand(name === 'users' ? sanitizeUser(r) : { ...r }, options.expand))
      return { page, perPage, totalItems, totalPages, items: items as T[] }
    },
    async getOne<T = Rec>(id: string, options: QueryOptions = {}): Promise<T> {
      const rec = coll(name).find((r) => r.id === id)
      if (!rec) throw notFoundError()
      return applyExpand(name === 'users' ? sanitizeUser(rec) : { ...rec }, options.expand) as T
    },
    async getFirstListItem<T = Rec>(filter: string, options: QueryOptions = {}): Promise<T> {
      const found = coll(name).find((r) => matchesFilter(r, filter))
      if (!found) throw notFoundError()
      return applyExpand(name === 'users' ? sanitizeUser(found) : { ...found }, options.expand) as T
    },
    async create<T = Rec>(data: Rec): Promise<T> {
      const arr = coll(name)
      const now = nowIso()
      const record: Rec = {
        id: genId(),
        created: now,
        updated: now,
        collectionId: name,
        collectionName: name,
        ...data,
      }
      if (name !== 'barangays' && name !== 'lookups' && !record.barangay_id) {
        record.barangay_id = authStore.record?.barangay_id || DEMO_BARANGAY_ID
      }
      arr.push(record)
      persist()
      return (name === 'users' ? sanitizeUser(record) : { ...record }) as T
    },
    async update<T = Rec>(id: string, data: Rec): Promise<T> {
      const arr = coll(name)
      const idx = arr.findIndex((r) => r.id === id)
      if (idx === -1) throw notFoundError()
      arr[idx] = { ...arr[idx], ...data, updated: nowIso() }
      persist()
      return (name === 'users' ? sanitizeUser(arr[idx]) : { ...arr[idx] }) as T
    },
    async delete(id: string): Promise<boolean> {
      const arr = coll(name)
      const idx = arr.findIndex((r) => r.id === id)
      if (idx !== -1) {
        arr.splice(idx, 1)
        persist()
      }
      return true
    },
  }

  if (name !== 'users') return base

  return {
    ...base,
    async authWithPassword(email: string, password: string) {
      const user = coll('users').find((u) => u.email === email)
      if (!user || user.password !== password) throw authError('Failed to authenticate.')
      const token = genToken()
      const clean = sanitizeUser(user)
      authStore.save(token, clean)
      return { token, record: clean }
    },
    async requestOTP(_email: string) {
      return { otpId: genId() }
    },
    async authWithOTP(_otpId: string, _code: string, _opts?: unknown) {
      // Demo accounts never require MFA, so this path is never exercised —
      // present only so callers that reference it don't hit an undefined method.
      throw authError('MFA is not used in demo mode.')
    },
    async authRefresh() {
      if (!authStore.isValid || !authStore.record) throw authError('Unauthorized.')
      const user = coll('users').find((u) => u.id === authStore.record!.id)
      if (!user) throw authError('Unauthorized.')
      const clean = sanitizeUser(user)
      authStore.save(authStore.token, clean)
      return { token: authStore.token, record: clean }
    },
  }
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export interface MockClient {
  authStore: MockAuthStore
  autoCancellation: (enable: boolean) => void
  filter: (raw: string, params?: Record<string, unknown>) => string
  collection: (name: string) => ReturnType<typeof makeRecordService>
}

export function createMockClient(): MockClient {
  const authStore = new MockAuthStore()
  return {
    authStore,
    autoCancellation() {
      // no-op — there's no real network layer to cancel requests on
    },
    filter: filterFn,
    collection(name: string) {
      return makeRecordService(name, authStore)
    },
  }
}
