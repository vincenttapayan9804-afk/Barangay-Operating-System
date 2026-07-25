import { useState, useEffect } from 'react'
import { KeyRound, Loader2, Plus, Trash2 } from 'lucide-react'
import { getClient } from '@/api/client'
import { registerPasskey, browserSupportsWebAuthn } from '@/lib/webauthn'
import { isDemoModeEnabled } from '@/lib/demoAccounts'
import { toast } from '@/lib/toast'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'

interface PasskeyRecord {
  id: string
  device_name?: string
  created: string
}

export function PasskeySettings() {
  const [passkeys, setPasskeys] = useState<PasskeyRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [deviceName, setDeviceName] = useState('')
  const [adding, setAdding] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<PasskeyRecord | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function refresh() {
    setLoading(true)
    try {
      const records = await getClient()
        .collection('webauthn_credentials')
        .getFullList<PasskeyRecord>({ sort: '-created' })
      setPasskeys(records)
    } catch {
      // Non-fatal — just leave the list empty rather than blocking the page.
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setAdding(true)
    try {
      await registerPasskey(deviceName.trim() || undefined)
      setDeviceName('')
      toast.success('Passkey added')
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not add this passkey')
    } finally {
      setAdding(false)
    }
  }

  async function handleDelete() {
    if (!pendingDelete) return
    setDeleting(true)
    try {
      await getClient().collection('webauthn_credentials').delete(pendingDelete.id)
      toast.success('Passkey removed')
      setPendingDelete(null)
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not remove this passkey')
    } finally {
      setDeleting(false)
    }
  }

  if (isDemoModeEnabled() || !browserSupportsWebAuthn()) return null

  return (
    <section className="rounded-lg border bg-card shadow-sm motion-fade-in motion-slide-up" style={{ animationDelay: '375ms' }}>
      <div className="flex items-center gap-2 border-b border-bamboo/40 px-4 py-2.5 dark:border-bamboo/20">
        <KeyRound className="size-4 text-muted-foreground/60" />
        <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground/70">
          Passkeys
        </h2>
      </div>
      <div className="space-y-3 p-3">
        <p className="text-[11px] text-muted-foreground/60">
          Sign in without a password using a fingerprint, face scan, or security key on this device.
        </p>

        {loading ? (
          <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground/60">
            <Loader2 className="size-3.5 animate-spin" />
            Loading passkeys...
          </div>
        ) : passkeys.length === 0 ? (
          <p className="text-xs italic text-muted-foreground/60">No passkeys registered yet.</p>
        ) : (
          <ul className="space-y-1.5">
            {passkeys.map((pk) => (
              <li
                key={pk.id}
                className="flex items-center justify-between gap-2 rounded-md border bg-secondary/30 px-3 py-2 text-xs"
              >
                <span className="min-w-0 flex-1 truncate font-medium text-secondary-foreground">
                  {pk.device_name || 'Passkey'}
                </span>
                <span className="shrink-0 text-muted-foreground/60">
                  Added {new Date(pk.created).toLocaleDateString()}
                </span>
                <button
                  type="button"
                  onClick={() => setPendingDelete(pk)}
                  className="inline-flex size-6 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:bg-destructive/20 hover:text-destructive"
                  aria-label={`Remove ${pk.device_name || 'passkey'}`}
                >
                  <Trash2 className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={handleAdd} className="flex gap-1.5">
          <input
            type="text"
            value={deviceName}
            onChange={(e) => setDeviceName(e.target.value)}
            placeholder="Name this device (optional)"
            className="h-8 min-w-0 flex-1 rounded-md border border-input bg-background px-2.5 text-xs placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <button
            type="submit"
            disabled={adding}
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-input px-2.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
          >
            {adding ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
            Add a passkey
          </button>
        </form>
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Remove this passkey?"
        message={`"${pendingDelete?.device_name || 'This passkey'}" will no longer be able to sign in to your account.`}
        confirmLabel="Remove"
        destructive
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </section>
  )
}
