import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PaginationProps {
  page: number
  totalPages: number
  totalItems: number
  onPageChange: (page: number) => void
  pageSize?: number
}

export default function Pagination({ page, totalPages, totalItems, onPageChange, pageSize = 25 }: PaginationProps) {
  if (totalPages <= 1 || totalItems === 0) return null

  const start = (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, totalItems)

  return (
    <div className="flex shrink-0 items-center justify-between border-t border-border/50 px-3 py-0.5">
      <p className="text-[11px] leading-relaxed text-muted-foreground/60">
        <span className="font-medium text-muted-foreground/80">{start}</span>
        <span className="mx-0.5">–</span>
        <span className="font-medium text-muted-foreground/80">{end}</span>
        <span className="mx-1">of</span>
        <span className="font-medium text-muted-foreground/80">{totalItems}</span>
      </p>
      <div className="flex items-center gap-px">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="flex size-5 items-center justify-center rounded-sm text-muted-foreground/40 hover:bg-accent hover:text-foreground disabled:opacity-15 disabled:pointer-events-none transition-colors"
        >
          <ChevronLeft className="size-3" />
        </button>
        {Array.from({ length: totalPages }, (_, i) => i + 1)
          .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
          .map((p, idx, arr) => (
            <span key={p} className="flex items-center">
              {idx > 0 && arr[idx - 1] !== p - 1 && (
                <span className="w-3 text-center text-[10px] text-muted-foreground/30">···</span>
              )}
              <button
                type="button"
                onClick={() => onPageChange(p)}
                className={cn(
                  'flex size-5 items-center justify-center rounded-sm text-[11px] font-semibold transition-colors',
                  p === page
                    ? 'bg-barangay text-white shadow-xs'
                    : 'text-muted-foreground/50 hover:bg-accent hover:text-foreground',
                )}
              >
                {p}
              </button>
            </span>
          ))}
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="flex size-5 items-center justify-center rounded-sm text-muted-foreground/40 hover:bg-accent hover:text-foreground disabled:opacity-15 disabled:pointer-events-none transition-colors"
        >
          <ChevronRight className="size-3" />
        </button>
      </div>
    </div>
  )
}
