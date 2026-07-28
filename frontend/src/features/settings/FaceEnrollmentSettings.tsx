import { useState, useEffect } from 'react'
import { ScanFace, Loader2, Trash2 } from 'lucide-react'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { getSupabase } from '@/lib/supabaseClient'
import { FaceCapture } from '@/components/FaceCapture'
import { isDemoModeEnabled } from '@/lib/demoAccounts'
import { toast } from '@/lib/toast'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'

// Security Phase 6 — the Settings-page counterpart to PasskeySettings.tsx.
// Enrolling here up front is what keeps login-gate's 3-failed-attempt
// step-up from soft-locking this account the first time it's needed: an
// account with no row in face_enrollments fails closed rather than
// silently skipping the face check (see backend/supabase/functions/
// login-gate/index.ts).
export function FaceEnrollmentSettings() {
  const [enrolled, setEnrolled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [capturing, setCapturing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [removing, setRemoving] = useState(false)

  async function refresh() {
    if (isDemoModeEnabled()) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const { data: userData } = await getSupabase().auth.getUser()
      const userId = userData.user?.id
      if (!userId) {
        setEnrolled(false)
        return
      }
      const { data, error } = await getSupabase().from('face_enrollments').select('user_id').eq('user_id', userId).maybeSingle()
      if (error) throw error
      setEnrolled(data !== null)
    } catch {
      // Non-fatal — leave the enrolled state as-is rather than blocking the page.
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  async function handleCapture(imageDataUrl: string) {
    setSubmitting(true)
    try {
      const { error } = await getSupabase().functions.invoke('enroll-face', { body: { image: imageDataUrl } })
      if (error) {
        if (error instanceof FunctionsHttpError) {
          const body = await error.context.json().catch(() => ({}))
          throw new Error(body?.error || 'Could not enroll your face')
        }
        throw error
      }
      toast.success('Face enrolled')
      setCapturing(false)
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not enroll your face')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleRemove() {
    setRemoving(true)
    try {
      const { error } = await getSupabase().functions.invoke('enroll-face', { method: 'DELETE' })
      if (error) throw error
      toast.success('Face enrollment removed')
      setConfirmRemove(false)
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not remove your face enrollment')
    } finally {
      setRemoving(false)
    }
  }

  if (isDemoModeEnabled()) return null

  return (
    <section className="rounded-lg border bg-card shadow-sm motion-fade-in motion-slide-up" style={{ animationDelay: '400ms' }}>
      <div className="flex items-center gap-2 border-b border-bamboo/40 px-4 py-2.5 dark:border-bamboo/20">
        <ScanFace className="size-4 text-muted-foreground/60" />
        <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground/70">
          Face Verification
        </h2>
      </div>
      <div className="space-y-3 p-3">
        <p className="text-[11px] text-muted-foreground/60">
          If your account has 3 failed sign-in attempts, the next login must also verify your face
          before it succeeds. Enroll now so you're never soft-locked out later.
        </p>

        {loading ? (
          <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground/60">
            <Loader2 className="size-3.5 animate-spin" />
            Checking enrollment...
          </div>
        ) : capturing ? (
          <FaceCapture onCapture={handleCapture} busy={submitting} captureLabel="Enroll this photo" />
        ) : enrolled ? (
          <div className="flex items-center justify-between gap-2 rounded-md border bg-secondary/30 px-3 py-2 text-xs">
            <span className="font-medium text-secondary-foreground">Face enrolled</span>
            <button
              type="button"
              onClick={() => setConfirmRemove(true)}
              className="inline-flex size-6 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:bg-destructive/20 hover:text-destructive"
              aria-label="Remove face enrollment"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        ) : (
          <p className="text-xs italic text-muted-foreground/60">No face enrolled yet.</p>
        )}

        {!loading && !capturing && (
          <button
            type="button"
            onClick={() => setCapturing(true)}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-input px-2.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <ScanFace className="size-3.5" />
            {enrolled ? 'Re-enroll with a new photo' : 'Enroll your face'}
          </button>
        )}
        {capturing && (
          <button
            type="button"
            onClick={() => setCapturing(false)}
            className="text-xs font-medium text-muted-foreground underline hover:text-foreground"
          >
            Cancel
          </button>
        )}
      </div>

      <ConfirmDialog
        open={confirmRemove}
        title="Remove your face enrollment?"
        message="Your account will fail closed (soft-locked, admin-unlock) instead of a face check the next time it hits 3 failed sign-in attempts, until you enroll again."
        confirmLabel="Remove"
        destructive
        loading={removing}
        onConfirm={handleRemove}
        onCancel={() => setConfirmRemove(false)}
      />
    </section>
  )
}
