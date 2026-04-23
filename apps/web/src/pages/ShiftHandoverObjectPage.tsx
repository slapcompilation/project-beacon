// Layer: Flow — Shift Handover Object Page
// Palantir-pattern: shift handovers are named, navigable events. An outgoing manager
// flags items that need attention. The incoming manager can see the full context.
// Route: /handover/:handoverId

import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { format, formatDistanceToNow } from 'date-fns'
import {
  ArrowLeft, AlertTriangle, Clock, User, Package,
  ChevronRight, Eye, Info,
} from 'lucide-react'
import type { ShiftHandover } from '@beacon/types'

// ─── Data fetcher ─────────────────────────────────────────────────────────────

async function fetchHandover(handoverId: string): Promise<ShiftHandover | null> {
  const { data, error } = await supabase
    .from('shift_handovers')
    .select('*')
    .eq('id', handoverId)
    .single() as unknown as {
      data: ShiftHandover | null
      error: { message: string } | null
    }
  if (error) throw new Error(error.message)
  return data
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const PRIORITY_META = {
  urgent: { cls: 'bg-red-500/10 text-red-500 border-red-500/30',     icon: AlertTriangle, label: 'Urgent' },
  watch:  { cls: 'bg-amber-500/10 text-amber-500 border-amber-500/30', icon: Eye,           label: 'Watch' },
  info:   { cls: 'bg-blue-500/10 text-blue-500 border-blue-500/30',   icon: Info,          label: 'Info' },
} as const

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ShiftHandoverObjectPage() {
  const { handoverId } = useParams<{ handoverId: string }>()
  const navigate       = useNavigate()

  const { data: handover, isLoading, error } = useQuery({
    queryKey:  ['handover-object', handoverId],
    queryFn:   () => fetchHandover(handoverId!),
    enabled:   !!handoverId,
    staleTime: 120_000,
  })

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
        Loading handover…
      </div>
    )
  }

  if (error || !handover) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
        <AlertTriangle className="h-8 w-8 text-red-500/60" />
        <p className="text-sm">Handover not found or access denied.</p>
        <button type="button" onClick={() => { navigate(-1) }} className="text-xs text-primary hover:underline">← Go back</button>
      </div>
    )
  }

  const flagged  = handover.flagged_items ?? []
  const urgentCount = flagged.filter((i) => i.priority === 'urgent').length
  const watchCount  = flagged.filter((i) => i.priority === 'watch').length

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="border-b px-6 py-4 shrink-0 bg-background">
        <div className="flex items-start gap-4">
          <button
            type="button"
            onClick={() => { void navigate(-1) }}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mt-0.5 shrink-0"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-950/40 shrink-0">
                <Clock className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-lg font-bold leading-none">Shift Handover</h1>
                  {urgentCount > 0 && (
                    <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border bg-red-500/10 text-red-500 border-red-500/30">
                      {urgentCount} URGENT
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  {handover.author_email && (
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {handover.author_email}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatDistanceToNow(new Date(handover.started_at), { addSuffix: true })}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 max-w-3xl">

        {/* Stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-lg border bg-card p-3 space-y-1">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Started</div>
            <div className="text-xs font-medium">{format(new Date(handover.started_at), 'dd MMM yyyy')}</div>
            <div className="text-[10px] text-muted-foreground">{format(new Date(handover.started_at), 'HH:mm')}</div>
          </div>
          <div className="rounded-lg border bg-card p-3 space-y-1">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Window</div>
            <div className="text-sm font-bold">{handover.window_hours}h</div>
            <div className="text-[10px] text-muted-foreground">review window</div>
          </div>
          <div className="rounded-lg border bg-card p-3 space-y-1">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Flagged</div>
            <div className={cn('text-xl font-bold font-mono tabular-nums', urgentCount > 0 ? 'text-red-600' : 'text-foreground')}>
              {flagged.length}
            </div>
            <div className="text-[10px] text-muted-foreground">
              {urgentCount > 0 ? `${urgentCount} urgent` : watchCount > 0 ? `${watchCount} to watch` : 'items'}
            </div>
          </div>
          <div className="rounded-lg border bg-card p-3 space-y-1">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Author</div>
            <div className="text-xs font-medium truncate">{handover.author_email ?? '—'}</div>
          </div>
        </div>

        {/* Notes */}
        {handover.notes && (
          <div className="rounded-lg border bg-muted/20 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Handover Notes</p>
            <p className="text-sm text-foreground leading-relaxed">{handover.notes}</p>
          </div>
        )}

        {/* Flagged items */}
        <div>
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
            Flagged Items ({flagged.length})
          </h2>

          {flagged.length === 0 ? (
            <div className="rounded-lg border bg-muted/10 px-4 py-8 text-center">
              <p className="text-sm text-muted-foreground">No items were flagged in this handover.</p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Scanned {formatDistanceToNow(new Date(handover.started_at), { addSuffix: true })} — all clear at shift end.
              </p>
            </div>
          ) : (
            <div className="rounded-lg border bg-card divide-y">
              {/* Urgent first, then watch, then info */}
              {(['urgent', 'watch', 'info'] as const).flatMap((priority) =>
                flagged.filter((item) => item.priority === priority).map((item) => {
                  const pm   = PRIORITY_META[item.priority]
                  const Icon = pm.icon
                  return (
                    <div key={`${item.variant_id}-${item.priority}`} className="flex items-start gap-3 px-4 py-3">
                      <span className={cn('text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border shrink-0 mt-0.5 flex items-center gap-1', pm.cls)}>
                        <Icon className="h-2.5 w-2.5" />
                        {pm.label}
                      </span>
                      <div className="flex-1 min-w-0">
                        <Link
                          to={`/variant/${item.variant_id}`}
                          className="flex items-center gap-1.5 text-sm font-medium hover:text-primary hover:underline"
                        >
                          <Package className="h-3.5 w-3.5 text-muted-foreground" />
                          {item.product_name}
                        </Link>
                        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{item.note}</p>
                      </div>
                      <Link to={`/variant/${item.variant_id}`} className="text-muted-foreground/40 hover:text-primary shrink-0">
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    </div>
                  )
                })
              )}
            </div>
          )}
        </div>

        {/* Metadata */}
        <div className="rounded-lg border bg-card divide-y text-xs">
          <div className="flex items-center justify-between px-4 py-2.5">
            <span className="text-muted-foreground">Handover ID</span>
            <span className="font-mono text-[10px]">{handover.id}</span>
          </div>
          <div className="flex items-center justify-between px-4 py-2.5">
            <span className="text-muted-foreground">Created</span>
            <span>{formatDistanceToNow(new Date(handover.created_at), { addSuffix: true })}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
