// Layer: Eye — cross-layer context panel for a single variant
// Surfaced on detail pages (Inventory, Restocks, Expiry) when navigating from
// a Briefing signal. Shows: velocity, runway, PO status, waste spike, expiry.
// Palantir principle: the system has already done the analysis. The panel
// shows the operator what matters without them having to ask.

import { cn } from '@/lib/utils'
import { useVariantIntelligence } from '../hooks'
import {
  TrendingUp, TrendingDown, Minus, PackageCheck, AlertTriangle,
  CalendarX, Loader2, ShieldCheck,
} from 'lucide-react'
import { format, parseISO } from 'date-fns'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function VelocityArrow({ pct }: { pct: number | null }) {
  if (pct === null) return <Minus className="h-3 w-3 text-muted-foreground" />
  if (pct >= 10)  return <TrendingUp   className="h-3 w-3 text-red-500"   />
  if (pct <= -10) return <TrendingDown className="h-3 w-3 text-green-500" />
  return <Minus className="h-3 w-3 text-muted-foreground" />
}

function RunwayBar({ days, tier }: { days: number; tier: 'critical' | 'warning' | 'watch' | 'safe' }) {
  const pct = Math.min(100, Math.max(0, (days / 14) * 100))
  const barCls =
    tier === 'critical' ? 'bg-red-500' :
    tier === 'warning'  ? 'bg-amber-500' :
    tier === 'watch'    ? 'bg-yellow-400' : 'bg-green-400'
  return (
    <div className="h-1 w-16 rounded-full bg-muted overflow-hidden">
      <div className={cn('h-full rounded-full transition-all', barCls)} style={{ width: `${String(pct)}%` }} />
    </div>
  )
}

function runwayTier(days: number | null): 'critical' | 'warning' | 'watch' | 'safe' {
  if (days === null)  return 'safe'
  if (days <= 3)      return 'critical'
  if (days <= 7)      return 'warning'
  if (days <= 14)     return 'watch'
  return 'safe'
}

// ─── Panel ────────────────────────────────────────────────────────────────────

interface EntityContextPanelProps {
  variantId: string | null
  /** compact = true → one-line summary bar. compact = false (default) → full card. */
  compact?: boolean
  className?: string
}

export function EntityContextPanel({ variantId, compact = false, className }: EntityContextPanelProps) {
  const { data: intel, isLoading } = useVariantIntelligence(variantId)

  if (!variantId) return null

  if (isLoading) {
    return (
      <div className={cn('flex items-center gap-2 text-xs text-muted-foreground px-3 py-2', className)}>
        <Loader2 className="h-3 w-3 animate-spin" />
        Loading intelligence…
      </div>
    )
  }

  if (!intel) return null

  const tier       = runwayTier(intel.days_until_zero)
  const tierCls    = tier === 'critical' ? 'text-red-600 dark:text-red-400' :
                     tier === 'warning'  ? 'text-amber-600 dark:text-amber-400' :
                     tier === 'watch'    ? 'text-yellow-600 dark:text-yellow-400' : 'text-green-600 dark:text-green-400'
  const hasSpike   = intel.waste_spike_pct !== null && intel.waste_spike_pct > 50
  const hasExpiry  = intel.expiry_date !== null && intel.value_at_risk > 0

  // ── Compact: single line ──────────────────────────────────────────────────
  if (compact) {
    return (
      <div className={cn('flex items-center gap-3 text-xs text-muted-foreground', className)}>
        <span className="font-medium text-foreground">{intel.current_stock} units</span>
        {intel.days_until_zero !== null && (
          <span className={cn('font-semibold tabular-nums', tierCls)}>
            ~{intel.days_until_zero}d left
          </span>
        )}
        <span className="tabular-nums">{intel.avg_daily_use}/day (30d avg)</span>
        {intel.velocity_change_pct !== null && (
          <span className="flex items-center gap-0.5">
            <VelocityArrow pct={intel.velocity_change_pct} />
            <span>{Math.abs(intel.velocity_change_pct)}% vs last month</span>
          </span>
        )}
        {intel.open_po_number && (
          <span className="flex items-center gap-1 text-green-700 dark:text-green-400">
            <PackageCheck className="h-3 w-3" />
            {intel.open_po_number}
          </span>
        )}
      </div>
    )
  }

  // ── Full card ─────────────────────────────────────────────────────────────
  return (
    <div className={cn(
      'rounded-lg border bg-muted/5 divide-y text-xs',
      tier === 'critical' && 'border-red-200 dark:border-red-900/40',
      tier === 'warning'  && 'border-amber-200 dark:border-amber-900/40',
      className,
    )}>
      {/* Velocity + runway */}
      <div className="flex items-center gap-4 px-4 py-3">
        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-foreground text-sm tabular-nums">
              {intel.current_stock} units
            </span>
            {intel.days_until_zero !== null && (
              <span className={cn('font-semibold tabular-nums', tierCls)}>
                ~{intel.days_until_zero}d left
              </span>
            )}
            {intel.days_until_zero !== null && (
              <RunwayBar days={intel.days_until_zero} tier={tier} />
            )}
          </div>
          <p className="text-muted-foreground">
            {intel.avg_daily_use} units/day (30d avg)
            {intel.velocity_change_pct !== null && (
              <span className="ml-1.5 inline-flex items-center gap-0.5">
                <VelocityArrow pct={intel.velocity_change_pct} />
                <span className={intel.velocity_change_pct >= 10 ? 'text-red-500' : intel.velocity_change_pct <= -10 ? 'text-green-500' : ''}>
                  {intel.velocity_change_pct > 0 ? '+' : ''}{intel.velocity_change_pct}% vs last month
                </span>
              </span>
            )}
          </p>
        </div>
        {intel.days_until_zero_7d !== null && intel.days_until_zero !== null &&
          Math.abs(intel.days_until_zero_7d - intel.days_until_zero) > 1 && (
          <div className="text-right shrink-0">
            <p className={cn('font-semibold tabular-nums', tierCls)}>
              ~{intel.days_until_zero_7d}d
            </p>
            <p className="text-muted-foreground">at 7d rate</p>
          </div>
        )}
      </div>

      {/* PO status */}
      <div className="flex items-center gap-2 px-4 py-2.5">
        {intel.open_po_number ? (
          <>
            <PackageCheck className="h-3.5 w-3.5 text-green-500 shrink-0" />
            <span className="text-green-700 dark:text-green-400 font-medium">
              PO {intel.open_po_number}
            </span>
            {intel.expected_delivery && (
              <span className="text-muted-foreground">
                · arriving {format(parseISO(intel.expected_delivery), 'MMM d')}
              </span>
            )}
          </>
        ) : (
          <>
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
            <span className="text-amber-700 dark:text-amber-400">No purchase order in flight</span>
          </>
        )}
      </div>

      {/* Waste spike — only shown when notable */}
      {hasSpike && (
        <div className="flex items-center gap-2 px-4 py-2.5">
          <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />
          <span>
            <span className="font-medium text-red-700 dark:text-red-400">Write-off spike: </span>
            {intel.waste_7d} units this week vs {intel.waste_avg_weekly} avg
            <span className="text-red-600 dark:text-red-400"> (+{intel.waste_spike_pct}%)</span>
            <span className="text-muted-foreground"> · {intel.avg_occupancy_7d}% occupancy</span>
          </span>
        </div>
      )}

      {/* Expiry — only shown when imminent and at-risk */}
      {hasExpiry && (
        <div className="flex items-center gap-2 px-4 py-2.5">
          <CalendarX className="h-3.5 w-3.5 text-orange-500 shrink-0" />
          <span>
            <span className="font-medium text-orange-700 dark:text-orange-400">Expiry: </span>
            {intel.expiry_date ? format(parseISO(intel.expiry_date), 'MMM d') : null}
            {intel.value_at_risk > 0 && (
              <span className="text-muted-foreground"> · €{intel.value_at_risk.toFixed(2)} at risk</span>
            )}
          </span>
        </div>
      )}

      {/* All clear */}
      {!hasSpike && !hasExpiry && intel.open_po_number && tier === 'safe' && (
        <div className="flex items-center gap-2 px-4 py-2.5 text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 text-green-500 shrink-0" />
          <span>Stock position healthy</span>
        </div>
      )}
    </div>
  )
}
