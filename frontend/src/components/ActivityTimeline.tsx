import { useEffect, useState } from 'react'
import { History, Plus, Pencil, Trash2 } from 'lucide-react'
import { getActivities, type ApiActivity } from '@/api/activity'
import { formatDateTime } from '@/lib/utils'
import { Spinner } from '@/components/ui/spinner'

const ACTION_ICON: Record<string, typeof Plus> = {
  create: Plus,
  update: Pencil,
  delete: Trash2,
}

const ACTION_COLOR: Record<string, string> = {
  create: 'text-teal bg-teal/10',
  update: 'text-blue-500 bg-blue-500/10',
  delete: 'text-destructive bg-destructive/10',
}

interface ActivityTimelineProps {
  collection: string
  recordId: string
  /** Max entries to show — a detail-panel history doesn't need pagination. */
  limit?: number
}

/**
 * Chronological who/when/what history for a single record, pulled from the
 * general activity_logs collection (already written by every create/update/
 * delete mutation across the app — see api/activity.ts's createActivity).
 * A read-only view over existing data, not a new audit mechanism.
 */
export function ActivityTimeline({ collection, recordId, limit = 8 }: ActivityTimelineProps) {
  const [entries, setEntries] = useState<ApiActivity[] | null>(null)

  useEffect(() => {
    let cancelled = false
    setEntries(null)
    getActivities(1, limit, '-created', collection, recordId)
      .then((res) => { if (!cancelled) setEntries(res.items) })
      .catch(() => { if (!cancelled) setEntries([]) })
    return () => { cancelled = true }
  }, [collection, recordId, limit])

  if (entries === null) {
    return (
      <div className="flex items-center justify-center py-4">
        <Spinner size="sm" />
      </div>
    )
  }

  if (entries.length === 0) {
    return <p className="py-2 text-xs text-muted-foreground">No recorded activity yet.</p>
  }

  return (
    <ol className="space-y-0">
      {entries.map((entry, i) => {
        const Icon = ACTION_ICON[entry.action] || History
        const colorClass = ACTION_COLOR[entry.action] || 'text-muted-foreground bg-muted'
        return (
          <li key={entry.id} className="relative flex gap-2.5 pb-3 last:pb-0">
            {i < entries.length - 1 && (
              <span className="absolute left-[11px] top-6 bottom-0 w-px bg-border" aria-hidden="true" />
            )}
            <span className={`relative z-10 flex size-[22px] shrink-0 items-center justify-center rounded-full ${colorClass}`}>
              <Icon className="size-3" />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="text-xs text-foreground">{entry.details}</p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                {entry.user_name} &middot; {formatDateTime(entry.created)}
              </p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
