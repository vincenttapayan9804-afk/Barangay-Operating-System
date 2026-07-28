import { useEffect, useRef, useState } from 'react'
import { Camera, Loader2, AlertCircle } from 'lucide-react'

interface FaceCaptureProps {
  onCapture: (imageDataUrl: string) => void
  busy?: boolean
  captureLabel?: string
}

// Shared getUserMedia + canvas-snapshot capture, used by both the login
// step-up challenge (auth/LoginPage.tsx) and Settings enrollment
// (features/settings/FaceEnrollmentSettings.tsx) — camera lifecycle
// (start on mount, always stop the stream's tracks on unmount so the
// browser's camera-in-use indicator doesn't linger) lives here once
// instead of duplicated in both call sites.
export function FaceCapture({ onCapture, busy = false, captureLabel = 'Capture photo' }: FaceCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) videoRef.current.srcObject = stream
        setReady(true)
      } catch {
        if (!cancelled) setError('Could not access your camera. Check your browser permissions and try again.')
      }
    }
    start()
    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [])

  function handleCapture() {
    const video = videoRef.current
    if (!video) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    onCapture(canvas.toDataURL('image/jpeg', 0.9))
  }

  if (error) {
    return (
      <div className="flex items-start gap-2 rounded-xl border border-red-pinoy/20 bg-red-pinoy/5 px-4 py-3 font-display text-sm text-red-pinoy">
        <AlertCircle className="mt-0.5 size-4 shrink-0" />
        <span>{error}</span>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="relative aspect-square w-full max-w-xs overflow-hidden rounded-xl bg-gray-900">
        <video ref={videoRef} autoPlay playsInline muted className="size-full -scale-x-100 object-cover" />
        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center text-white/70">
            <Loader2 className="size-6 animate-spin" />
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={handleCapture}
        disabled={!ready || busy}
        className="flex w-full max-w-xs items-center justify-center gap-2 rounded-full bg-gradient-to-r from-barangay to-[#06110D] px-4 py-3 font-display text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:from-[#06110D] hover:to-barangay disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
        {captureLabel}
      </button>
    </div>
  )
}
