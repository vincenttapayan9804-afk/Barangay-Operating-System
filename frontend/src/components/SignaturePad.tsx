import { useRef, useEffect, useState } from 'react'
import { Eraser } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface SignaturePadProps {
  /** Called with a PNG data URL on every stroke completion, or null once cleared. */
  onChange: (dataUrl: string | null) => void
  className?: string
}

/**
 * Hand-rolled canvas signature capture — no new dependency needed for
 * something this small. Captures pointer strokes (mouse, touch, and pen
 * all fire the same pointer events), renders at 2x devicePixelRatio for a
 * crisp line, and exports a small PNG data URL.
 */
export function SignaturePad({ onChange, className }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawingRef = useRef(false)
  const hasStrokeRef = useRef(false)
  const [isEmpty, setIsEmpty] = useState(true)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx.scale(dpr, dpr)
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#10201B'
  }, [])

  function getPos(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    e.currentTarget.setPointerCapture(e.pointerId)
    drawingRef.current = true
    const { x, y } = getPos(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const { x, y } = getPos(e)
    ctx.lineTo(x, y)
    ctx.stroke()
    hasStrokeRef.current = true
  }

  function handlePointerUp() {
    if (!drawingRef.current) return
    drawingRef.current = false
    if (hasStrokeRef.current) {
      setIsEmpty(false)
      onChange(canvasRef.current?.toDataURL('image/png') ?? null)
    }
  }

  function handleClear() {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const dpr = window.devicePixelRatio || 1
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr)
    hasStrokeRef.current = false
    setIsEmpty(true)
    onChange(null)
  }

  return (
    <div className={className}>
      <div className="relative rounded-md border border-input bg-background">
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          className="h-32 w-full touch-none rounded-md"
          role="img"
          aria-label="Signature capture area"
        />
        {isEmpty && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-muted-foreground/50">
            Sign here
          </span>
        )}
      </div>
      <div className="mt-1.5 flex items-center justify-between">
        <p className="text-[11px] text-muted-foreground">Recipient signs to confirm receipt.</p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn('h-6 gap-1 px-1.5 text-[11px] text-muted-foreground', isEmpty && 'invisible')}
          onClick={handleClear}
        >
          <Eraser className="size-3" />
          Clear
        </Button>
      </div>
    </div>
  )
}
