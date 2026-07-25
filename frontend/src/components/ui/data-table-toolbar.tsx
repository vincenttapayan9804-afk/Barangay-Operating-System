import { useState, useRef, useEffect, type ReactNode } from 'react'
import { Download, Columns2, Minimize2, X, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

export interface ToolbarColumn {
  key: string
  label: string
  visible: boolean
}

export interface DataTableToolbarProps {
  selectedCount: number
  onClearSelection: () => void
  onExport: () => void
  dense: boolean
  onDenseToggle: () => void
  columns: ToolbarColumn[]
  onColumnVisibilityChange: (key: string, visible: boolean) => void
  className?: string
  title?: string
  actions?: ReactNode
  page?: number
  totalPages?: number
  totalItems?: number
  onPageChange?: (page: number) => void
  pageSize?: number
}

export function DataTableToolbar({
  selectedCount, onClearSelection, onExport, dense, onDenseToggle,
  columns, onColumnVisibilityChange, className,
  title, actions,
  page, totalPages, totalItems, onPageChange, pageSize = 25,
}: DataTableToolbarProps) {
  const [columnOpen, setColumnOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setColumnOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div className={cn('flex items-center justify-between gap-2 px-2 py-1.5 border-b border-border/60', className)}>
      <div className="flex items-center gap-2">
        {title && (
          <h2 className="font-display text-xs font-semibold text-foreground whitespace-nowrap tracking-tight">{title}</h2>
        )}
        {selectedCount > 0 && (
          <div className="flex items-center gap-1.5 bg-gold/10 px-2.5 py-1 text-xs font-medium text-gold motion-fade-in">
            <span>{selectedCount} selected</span>
            <button type="button" onClick={onClearSelection} className="hover:text-foreground transition-colors" aria-label="Clear selection">
              <X className="size-3" />
            </button>
          </div>
        )}
      </div>
      <div className="flex items-center gap-1">
        {page !== undefined && totalPages !== undefined && totalPages > 1 && (
          <div className="flex items-center gap-0.5 mr-0.5">
            <span className="text-[10px] tabular-nums text-muted-foreground/50 whitespace-nowrap mr-0.5 font-medium">
              {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, totalItems ?? 0)}
              <span className="mx-0.5">/</span>
              {totalItems}
            </span>
            <button
              type="button"
              onClick={() => onPageChange?.(page - 1)}
              disabled={page <= 1}
              className="flex size-3 items-center justify-center rounded-sm text-muted-foreground/30 hover:bg-accent hover:text-foreground disabled:opacity-15 disabled:pointer-events-none transition-colors"
            >
              <ChevronLeft className="size-2.5" />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
              .map((p, idx, arr) => (
                <span key={p} className="flex items-center">
                  {idx > 0 && arr[idx - 1] !== p - 1 && (
                    <span className="w-2 text-center text-[8px] text-muted-foreground/30">···</span>
                  )}
                  <button
                    type="button"
                    onClick={() => onPageChange?.(p)}
                    className={cn(
                      'flex size-3 items-center justify-center rounded-sm text-[8px] font-semibold transition-colors',
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
              onClick={() => onPageChange?.(page + 1)}
              disabled={page >= totalPages}
              className="flex size-3 items-center justify-center rounded-sm text-muted-foreground/30 hover:bg-accent hover:text-foreground disabled:opacity-15 disabled:pointer-events-none transition-colors"
            >
              <ChevronRight className="size-2.5" />
            </button>
          </div>
        )}
        <div className="flex items-center gap-1 border-l border-border/40 pl-1.5">
          <Button variant="ghost" size="icon" onClick={onDenseToggle} title="Toggle dense mode" className="h-6 w-6 rounded-sm">
            <Minimize2 className={cn('size-3 transition-transform', dense && 'rotate-180')} />
          </Button>
          <Button variant="ghost" size="icon" onClick={onExport} title="Export to CSV" className="h-6 w-6 rounded-sm">
            <Download className="size-3" />
          </Button>
          <div ref={ref} className="relative">
            <Button variant="ghost" size="icon" onClick={() => setColumnOpen((o) => !o)} title="Toggle columns" className="h-6 w-6 rounded-sm">
              <Columns2 className="size-3" />
            </Button>
            {columnOpen && (
              <div className="absolute right-0 top-full z-50 mt-1 min-w-40 border bg-card p-1.5 shadow-lg motion-scale-in">
                {columns.map((col) => (
                  <label
                    key={col.key}
                    className="flex items-center gap-2 px-2 py-1.5 text-xs hover:bg-accent cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={col.visible}
                      onChange={(e) => onColumnVisibilityChange(col.key, e.target.checked)}
                      className="size-3.5 accent-gold"
                    />
                    {col.label}
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
        {actions}
      </div>
    </div>
  )
}
