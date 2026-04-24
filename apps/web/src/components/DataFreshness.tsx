// Layer: meta — data freshness indicator
// Palantir principle #7: stale data is wrong data.
// Shows how fresh the data is with a pulsing green dot when live, amber when stale.
//
// Usage with TanStack Query:
//   const { dataUpdatedAt, isFetching } = useProducts()
//   <DataFreshness updatedAt={dataUpdatedAt} isFetching={isFetching} />
//
// Usage with a static timestamp:
//   <DataFreshness updatedAt={Date.now()} />

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'

interface DataFreshnessProps {
  /** Unix timestamp (ms) from useQuery's dataUpdatedAt */
  updatedAt: number | undefined
  /** Whether a background refetch is in progress */
  isFetching?: boolean
  /** After this many ms, data is considered stale and indicator turns amber (default 60s) */
  staleAfterMs?: number
  className?: string
  /** Label prefix (e.g., "Inventory") — shown before the time string */
  label?: string
}

function formatAgo(ms: number): string {
  const sec = Math.round(ms / 1000)
  if (sec < 5) return 'just now'
  if (sec < 60) return `${sec}s ago`
  const min = Math.round(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.round(min / 60)
  return `${hr}h ago`
}

export function DataFreshness({
  updatedAt,
  isFetching = false,
  staleAfterMs = 60_000,
  className,
  label,
}: DataFreshnessProps) {
  const [now, setNow] = useState(Date.now())

  // Tick every 5s so "12s ago" updates
  useEffect(() => {
    const id = setInterval(() => { setNow(Date.now()) }, 5_000)
    return () => { clearInterval(id) }
  }, [])

  if (!updatedAt) return null

  const age = now - updatedAt
  const isStale = age > staleAfterMs
  const isFresh = age < 10_000 // under 10s = just-fetched pulse

  return (
    <span className={cn('inline-flex items-center gap-1.5 text-[10px] text-muted-foreground tabular-nums', className)}>
      {/* Status dot */}
      <span className="relative flex h-1.5 w-1.5">
        {isFetching ? (
          // Spinning dot while fetching
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60" />
        ) : isFresh ? (
          // Pulse when data just arrived
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
        ) : null}
        <span
          className={cn(
            'relative inline-flex h-1.5 w-1.5 rounded-full',
            isFetching ? 'bg-primary' : isStale ? 'bg-amber-400' : 'bg-emerald-400',
          )}
        />
      </span>

      {label && <span className="text-muted-foreground/70">{label}</span>}
      <span>{formatAgo(age)}</span>
    </span>
  )
}

// ─── PanelHeader — standard panel header with title + data freshness ─────────

interface PanelHeaderProps {
  title: string
  updatedAt?: number
  isFetching?: boolean
  /** Extra content (e.g., filter buttons) rendered after the freshness indicator */
  actions?: React.ReactNode
  className?: string
}

export function PanelHeader({ title, updatedAt, isFetching, actions, className }: PanelHeaderProps) {
  return (
    <div className={cn('flex items-center gap-3 px-4 py-2 border-b border-border bg-surface-1', className)}>
      <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{title}</h2>
      {updatedAt != null && (
        <DataFreshness updatedAt={updatedAt} isFetching={isFetching} />
      )}
      {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
    </div>
  )
}
