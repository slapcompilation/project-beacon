// Shared metric strip band for object views — the KPI row under the header
// (CLAUDE.md anatomy: header → metric strip → action bar → body → right-rail
// audit). Serves both the simple AIP-native metrics and the richer operational
// ones (value + sub-line + color accent) so every object view reads identically.

import type { ReactNode } from 'react'
import { Tooltip } from '@blueprintjs/core'
import { cn } from '@/lib/utils'

export type MetricAccent = 'green' | 'amber' | 'red' | 'muted'

const ACCENT: Record<MetricAccent, string> = {
  green: 'text-emerald-500',
  amber: 'text-amber-500',
  red:   'text-red-500',
  muted: 'text-muted-foreground',
}

export function MetricStrip({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-px border-b bg-border shrink-0">
      {children}
    </div>
  )
}

export function Metric({ label, value, sub, accent, capitalize, info }: {
  label: string
  value: ReactNode
  sub?: string
  accent?: MetricAccent
  /** Title-case the value — for lowercase enum values (status/bucket/severity). */
  capitalize?: boolean
  /** Plain-language definition (usually GLOSSARY.<term>) shown on label hover. */
  info?: string
}) {
  const labelEl = (
    <p className={cn(
      'text-[10px] uppercase tracking-widest font-bold text-muted-foreground mb-1',
      info && 'cursor-help underline decoration-dotted decoration-muted-foreground/40 underline-offset-2',
    )}>{label}</p>
  )
  return (
    <div className="bg-background px-4 py-3">
      {info ? <Tooltip content={info} placement="top" compact className="!block"><span>{labelEl}</span></Tooltip> : labelEl}
      <div className={cn('text-sm font-semibold tabular-nums', capitalize && 'capitalize', accent && ACCENT[accent])}>{value}</div>
      {sub && <div className="text-[11px] font-normal text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  )
}
