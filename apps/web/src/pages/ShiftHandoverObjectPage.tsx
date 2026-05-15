// Layer: Flow — Shift Handover Object Page
// Palantir-pattern: shift handovers are named, navigable events. An outgoing manager
// flags items that need attention. The incoming manager can see the full context.
// Route: /handover/:handoverId
//
// 100% Blueprint — no shadcn primitives, no lucide icons.

import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { format, formatDistanceToNow } from 'date-fns'
import {
  Button,
  Card,
  Icon,
  Intent,
  NonIdealState,
  Tag,
} from '@blueprintjs/core'
import type { IconName } from '@blueprintjs/icons'
import { supabase } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
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

const PRIORITY_META: Record<'urgent' | 'watch' | 'info', { intent: Intent; icon: IconName; label: string }> = {
  urgent: { intent: Intent.DANGER,  icon: 'warning-sign', label: 'Urgent' },
  watch:  { intent: Intent.WARNING, icon: 'eye-open',     label: 'Watch' },
  info:   { intent: Intent.PRIMARY, icon: 'info-sign',    label: 'Info' },
}

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
      <NonIdealState
        icon="warning-sign"
        title="Handover not found"
        description="Handover not found or access denied."
        action={
          <Button variant="minimal" intent={Intent.PRIMARY} onClick={() => { navigate(-1) }}>
            ← Go back
          </Button>
        }
      />
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
          <Button
            icon="arrow-left"
            variant="minimal"
            size="small"
            onClick={() => { void navigate(-1) }}
          >
            Back
          </Button>

          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded bg-indigo-100 dark:bg-indigo-950/40 shrink-0">
                <Icon icon="time" size={20} className="text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-lg font-bold leading-none">Shift Handover</h1>
                  {urgentCount > 0 && (
                    <Tag intent={Intent.DANGER} minimal>
                      {urgentCount} URGENT
                    </Tag>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  {handover.author_email && (
                    <span className="flex items-center gap-1">
                      <Icon icon="user" size={12} />
                      {handover.author_email}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Icon icon="time" size={12} />
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
          <Card compact>
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Started</div>
            <div className="text-xs font-medium">{format(new Date(handover.started_at), 'dd MMM yyyy')}</div>
            <div className="text-[10px] text-muted-foreground">{format(new Date(handover.started_at), 'HH:mm')}</div>
          </Card>
          <Card compact>
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Window</div>
            <div className="text-sm font-bold">{handover.window_hours}h</div>
            <div className="text-[10px] text-muted-foreground">review window</div>
          </Card>
          <Card compact>
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Flagged</div>
            <div className={cn('text-xl font-bold font-mono tabular-nums', urgentCount > 0 ? 'text-red-600' : 'text-foreground')}>
              {flagged.length}
            </div>
            <div className="text-[10px] text-muted-foreground">
              {urgentCount > 0 ? `${urgentCount} urgent` : watchCount > 0 ? `${watchCount} to watch` : 'items'}
            </div>
          </Card>
          <Card compact>
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Author</div>
            <div className="text-xs font-medium truncate">{handover.author_email ?? '—'}</div>
          </Card>
        </div>

        {/* Notes */}
        {handover.notes && (
          <Card compact className="!bg-muted/20">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Handover Notes</p>
            <p className="text-sm text-foreground leading-relaxed">{handover.notes}</p>
          </Card>
        )}

        {/* Flagged items */}
        <div>
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
            Flagged Items ({flagged.length})
          </h2>

          {flagged.length === 0 ? (
            <Card compact className="!bg-muted/10 text-center">
              <p className="text-sm text-muted-foreground">No items were flagged in this handover.</p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Scanned {formatDistanceToNow(new Date(handover.started_at), { addSuffix: true })} — all clear at shift end.
              </p>
            </Card>
          ) : (
            <Card compact className="!p-0 divide-y">
              {/* Urgent first, then watch, then info */}
              {(['urgent', 'watch', 'info'] as const).flatMap((priority) =>
                flagged.filter((item) => item.priority === priority).map((item) => {
                  const pm   = PRIORITY_META[item.priority]
                  return (
                    <div key={`${item.variant_id}-${item.priority}`} className="flex items-start gap-3 px-4 py-3">
                      <Tag icon={pm.icon} intent={pm.intent} minimal className="shrink-0 mt-0.5">
                        {pm.label}
                      </Tag>
                      <div className="flex-1 min-w-0">
                        <Link
                          to={`/variant/${item.variant_id}`}
                          className="flex items-center gap-1.5 text-sm font-medium hover:text-primary hover:underline"
                        >
                          <Icon icon="box" size={14} className="text-muted-foreground" />
                          {item.product_name}
                        </Link>
                        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{item.note}</p>
                      </div>
                      <Link to={`/variant/${item.variant_id}`} className="text-muted-foreground/40 hover:text-primary shrink-0">
                        <Icon icon="chevron-right" size={14} />
                      </Link>
                    </div>
                  )
                })
              )}
            </Card>
          )}
        </div>

        {/* Metadata */}
        <Card compact className="!p-0 divide-y text-xs">
          <div className="flex items-center justify-between px-4 py-2.5">
            <span className="text-muted-foreground">Handover ID</span>
            <span className="font-mono text-[10px]">{handover.id}</span>
          </div>
          <div className="flex items-center justify-between px-4 py-2.5">
            <span className="text-muted-foreground">Created</span>
            <span>{formatDistanceToNow(new Date(handover.created_at), { addSuffix: true })}</span>
          </div>
        </Card>
      </div>
    </div>
  )
}
