import { useState, useEffect } from 'react'
import { getApiUrl } from './apiConfig'

export interface HealthStatus {
  healthy: boolean | null
  loading: boolean
}

export function useApiHealth(): HealthStatus {
  const [healthy, setHealthy] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    const check = async () => {
      try {
        const res = await fetch(`${getApiUrl()}/api/health`, {
          signal: AbortSignal.timeout(5000),
        })
        if (!cancelled) setHealthy(res.ok)
      } catch {
        if (!cancelled) setHealthy(false)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    check()
    const interval = setInterval(check, 30000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  return { healthy, loading }
}
