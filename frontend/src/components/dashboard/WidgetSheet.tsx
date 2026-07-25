import { useEffect } from 'react'
import { X, SlidersHorizontal } from 'lucide-react'
import type { WidgetDefinition, ConfigField } from './widgetRegistry'
import type { DashboardConfig, WidgetState } from './useWidgetConfig'

interface WidgetSheetProps {
  open: boolean
  onClose: () => void
  widgets: WidgetDefinition[]
  config: DashboardConfig
  onUpdateWidget: (id: string, changes: Partial<WidgetState>) => void
  onReset: () => void
}

export function WidgetSheet({ open, onClose, widgets, config, onUpdateWidget, onReset }: WidgetSheetProps) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  return (
    <>
      <div className="fixed inset-0 z-40 bg-surface-overlay" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 flex w-80 flex-col border-l border-border bg-card shadow-xl motion-fade-in motion-slide-up">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <SlidersHorizontal className="size-4" />
            Customize
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground">
            <X className="size-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-4">
            {widgets.map((w) => {
              const state = config.widgets[w.id]
              return (
                <div key={w.id} className="rounded-lg border border-border p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">{w.label}</p>
                      <p className="text-xs text-muted-foreground">{w.description}</p>
                    </div>
                    <label className="relative inline-flex h-5 w-9 cursor-pointer items-center">
                      <input
                        type="checkbox"
                        className="peer sr-only"
                        checked={state?.visible ?? false}
                        onChange={(e) => onUpdateWidget(w.id, { visible: e.target.checked })}
                      />
                      <span className="absolute inset-0 rounded-full bg-muted-foreground/30 transition-colors peer-checked:bg-barangay peer-focus-visible:outline-2 peer-focus-visible:outline-ring" />
                      <span className="absolute left-0.5 size-4 rounded-full bg-white transition-transform peer-checked:translate-x-4" />
                    </label>
                  </div>

                  {w.configFields && state?.visible && (
                    <div className="mt-3 space-y-3 border-t border-border pt-3">
                      {w.configFields.map((field) => (
                        <WidgetConfigField
                          key={field.key}
                          field={field}
                          value={(state.config as Record<string, unknown>)?.[field.key]}
                          onChange={(val) =>
                            onUpdateWidget(w.id, {
                              config: { ...(state.config as Record<string, unknown>), [field.key]: val },
                            })
                          }
                        />
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <div className="border-t border-border p-4">
          <button
            onClick={onReset}
            className="w-full rounded-md border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          >
            Reset to Role Defaults
          </button>
        </div>
      </div>
    </>
  )
}

function WidgetConfigField({
  field,
  value,
  onChange,
}: {
  field: ConfigField
  value: unknown
  onChange: (val: unknown) => void
}) {
  if (field.type === 'checkbox-list' && field.items) {
    const selected: string[] = Array.isArray(value) ? value : field.items.map((i) => i.value)
    return (
      <div>
        <p className="mb-1 text-xs font-medium text-muted-foreground">{field.label}</p>
        <div className="space-y-1">
          {field.items.map((item) => (
            <label key={item.value} className="flex items-center gap-2 text-xs text-foreground">
              <input
                type="checkbox"
                className="size-3.5 rounded border-border text-barangay focus:ring-barangay"
                checked={selected.includes(item.value)}
                onChange={() => {
                  const next = selected.includes(item.value)
                    ? selected.filter((v) => v !== item.value)
                    : [...selected, item.value]
                  onChange(next)
                }}
              />
              {item.label}
            </label>
          ))}
        </div>
      </div>
    )
  }

  if (field.type === 'segmented' && field.options) {
    const current = (value as string) ?? field.options[0]?.value
    return (
      <div>
        <p className="mb-1 text-xs font-medium text-muted-foreground">{field.label}</p>
        <div className="flex overflow-hidden rounded-md border border-border">
          {field.options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onChange(opt.value)}
              className={`flex-1 px-2 py-1 text-xs font-medium transition-colors ${
                current === opt.value
                  ? 'bg-barangay text-white'
                  : 'bg-card text-muted-foreground hover:bg-accent'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    )
  }

  if (field.type === 'number') {
    const num = (value as number) ?? field.min ?? 5
    return (
      <div>
        <p className="mb-1 text-xs font-medium text-muted-foreground">{field.label}</p>
        <input
          type="number"
          min={field.min}
          max={field.max}
          value={num}
          onChange={(e) => onChange(parseInt(e.target.value, 10))}
          className="w-20 rounded-md border border-input bg-card px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>
    )
  }

  return null
}
