// CLUSTR brand mark — a small cluster of connected nodes, standing in for
// many barangays operating as one connected system. Built as inline SVG
// (not a raster asset) so it stays crisp at any size and can be recolored
// per-theme without shipping multiple image files.
export function ClustrMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id="clustr-mark-grad" x1="4" y1="4" x2="36" y2="36" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#00E6AF" />
          <stop offset="1" stopColor="#009E77" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="38" height="38" rx="11" fill="url(#clustr-mark-grad)" />
      <line x1="14" y1="14" x2="26" y2="14" stroke="white" strokeOpacity="0.55" strokeWidth="1.5" />
      <line x1="14" y1="14" x2="20" y2="26" stroke="white" strokeOpacity="0.55" strokeWidth="1.5" />
      <line x1="26" y1="14" x2="20" y2="26" stroke="white" strokeOpacity="0.55" strokeWidth="1.5" />
      <circle cx="14" cy="14" r="4" fill="white" />
      <circle cx="26" cy="14" r="4" fill="white" fillOpacity="0.85" />
      <circle cx="20" cy="26" r="4.5" fill="white" />
    </svg>
  )
}

export function ClustrWordmark({ className }: { className?: string }) {
  return (
    <span className={className}>
      CLUSTR
    </span>
  )
}
