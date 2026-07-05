import { useEffect, useState } from 'react'

type Status = 'loading' | 'ok' | 'error'

const API_URL = import.meta.env.VITE_API_URL

export default function HealthStatus() {
  const [status, setStatus] = useState<Status>('loading')
  const [detail, setDetail] = useState<string>('')

  useEffect(() => {
    let cancelled = false

    fetch(`${API_URL}/health`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return
        setStatus(data.status === 'ok' ? 'ok' : 'error')
        setDetail(data.status ?? 'unknown')
      })
      .catch((err) => {
        if (cancelled) return
        setStatus('error')
        setDetail(err instanceof Error ? err.message : 'unreachable')
      })

    return () => {
      cancelled = true
    }
  }, [])

  const color =
    status === 'ok'
      ? 'bg-green-500'
      : status === 'error'
        ? 'bg-red-500'
        : 'bg-yellow-500'

  return (
    <div className="flex items-center gap-2 border-b border-border px-4 py-2 text-sm">
      <span className={`h-2 w-2 rounded-full ${color}`} />
      <span className="text-muted-foreground">
        {status === 'loading' ? 'checking backend…' : `status: ${detail}`}
      </span>
    </div>
  )
}
