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
import type { ShiftHandover } from '@beacon/types'
import { ObjectHeaderBand } from '@/components/ObjectHeaderBand'
import { MetricStrip, Metric } from '@/components/MetricStrip'

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
  const { handoverId = '' } = useParams<{ handoverId: string }>()
  const navigate       = useNavigate()

  const { data: handover, isLoading, error } = useQuery({
    queryKey:  ['handover-object', handoverId],
    queryFn:   () => fetchHandover(handoverId),
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
          <Button variant="minimal" intent={Intent.PRIMARY} onClick={() => { void navigate(-1) }}>
            ← Go back
          </Button>
        }
      />
    )
  }

  const flagged  = handover.flagged_items
  const urgentCount = flagged.filter((i) => i.priority === 'urgent').length
  const watchCount  = flagged.filter((i) => i.priority === 'watch').length

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <ObjectHeaderBand
        breadcrumb={{ label: 'Handovers', to: '/flow' }}
        icon="time"
        title="Shift Handover"
        star={{ id: `shift_handover:${handover.id}`, label: 'Shift Handover', subtitle: handover.author_email ?? 'Handover', path: `/handover/${handover.id}`, icon: 'time' }}
        tags={
          <>
            {urgentCount > 0 && <Tag intent={Intent.DANGER} minimal>{urgentCount} URGENT</Tag>}
            {handover.author_email && <Tag minimal icon="user">{handover.author_email}</Tag>}
          </>
        }
        id={handover.id}
      />

      <MetricStrip>
        <Metric label="Started" value={format(new Date(handover.started_at), 'dd MMM yyyy')} sub={format(new Date(handover.started_at), 'HH:mm')} />
        <Metric label="Window" value={`${handover.window_hours}h`} sub="review window" />
        <Metric label="Flagged" value={flagged.length} sub={urgentCount > 0 ? `${urgentCount} urgent` : watchCount > 0 ? `${watchCount} to watch` : 'items'} accent={urgentCount > 0 ? 'red' : undefined} />
        <Metric label="Author" value={handover.author_email ?? '—'} />
      </MetricStrip>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">

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
