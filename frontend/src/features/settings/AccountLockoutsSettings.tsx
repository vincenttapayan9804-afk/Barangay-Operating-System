import { useState, useEffect } from 'react'
import { ShieldAlert, Loader2, LockOpen } from 'lucide-react'
import { getSupabase } from '@/lib/supabaseClient'
import { isDemoModeEnabled } from '@/lib/demoAccounts'
import { toast } from '@/lib/toast'

interface LockedAccountRow {
  user_id: string
  failed_count: number
  locked_at: string
  profile: { name: string | null } | null
}

// Security Phase 6's admin-unlock capability — this Settings page is
// already admin-only (see routes/index.tsx's roles={['admin']} gate on
// /settings), so unlike PasskeySettings/FaceEnrollmentSettings (which
// manage the signed-in admin's own account), this one lists every locked
// account in the admin's own barangay and clears login-gate's step-up lock
// directly (RLS's login_attempts_admin_unlock policy — same-barangay admin
// — is what actually authorizes the update below, not this component).
export function AccountLockoutsSettings() {
  const [rows, setRows] = useState<LockedAccountRow[]>([])
  const [loading, setLoading] = useState(true)
  const [unlockingId, setUnlockingId] = useState<string | null>(null)

  async function refresh() {
    if (isDemoModeEnabled()) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const { data, error } = await getSupabase()
        .from('login_attempts')
        .select('user_id, failed_count, locked_at, profile:profiles(name)')
        .not('locked_at', 'is', null)
        .order('locked_at', { ascending: false })
      if (error) throw error
      setRows((data ?? []) as unknown as LockedAccountRow[])
    } catch {
      // Non-fatal — leave the list empty rather than blocking the page.
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  async function handleUnlock(userId: string) {
    setUnlockingId(userId)
    try {
      const { error } = await getSupabase()
        .from('login_attempts')
        .update({ failed_count: 0, locked_at: null })
        .eq('user_id', userId)
      if (error) throw error
      toast.success('Account unlocked')
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not unlock this account')
    } finally {
      setUnlockingId(null)
    }
  }

  if (isDemoModeEnabled()) return null

  return (
    <section className="rounded-lg border bg-card shadow-sm motion-fade-in motion-slide-up" style={{ animationDelay: '425ms' }}>
      <div className="flex items-center gap-2 border-b border-bamboo/40 px-4 py-2.5 dark:border-bamboo/20">
        <ShieldAlert className="size-4 text-muted-foreground/60" />
        <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground/70">
          Locked Accounts
        </h2>
      </div>
      <div className="space-y-3 p-3">
        <p className="text-[11px] text-muted-foreground/60">
          These accounts hit 3 failed sign-in attempts and are waiting on a face-verification
          step-up (or have no face enrolled, and are soft-locked until unlocked here).
        </p>

        {loading ? (
          <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground/60">
            <Loader2 className="size-3.5 animate-spin" />
            Loading...
          </div>
        ) : rows.length === 0 ? (
          <p className="text-xs italic text-muted-foreground/60">No locked accounts right now.</p>
        ) : (
          <ul className="space-y-1.5">
            {rows.map((row) => (
              <li
                key={row.user_id}
                className="flex items-center justify-between gap-2 rounded-md border bg-secondary/30 px-3 py-2 text-xs"
              >
                <span className="min-w-0 flex-1 truncate font-medium text-secondary-foreground">
                  {row.profile?.name || 'Unnamed account'}
                </span>
                <span className="shrink-0 text-muted-foreground/60">
                  {row.failed_count} failed attempt{row.failed_count === 1 ? '' : 's'}
                </span>
                <button
                  type="button"
                  onClick={() => handleUnlock(row.user_id)}
                  disabled={unlockingId === row.user_id}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-input px-2 py-1 text-[11px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
                >
                  {unlockingId === row.user_id ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <LockOpen className="size-3" />
                  )}
                  Unlock
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
