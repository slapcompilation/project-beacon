// Layer: Eye — Alert Object Page
// Palantir-pattern: every alert is a navigable entity with full context — what triggered it,
// which node it concerns, how it was resolved, and the operator's feedback.
// Route: /alert/:alertId
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
import type { Notification } from '@beacon/types'

// ─── Local types ──────────────────────────────────────────────────────────────

interface AlertWithContext extends Notification {
  product_variants: {
    id: string
    name: string
    sku: string
    current_stock: number
    products: { id: string; name: string } | null
  } | null
}

// ─── Data fetcher ─────────────────────────────────────────────────────────────

async function fetchAlert(alertId: string): Promise<AlertWithContext | null> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*, product_variants(id, name, sku, current_stock, products(id, name))')
    .eq('id', alertId)
    .single() as unknown as {
      data: AlertWithContext | null
      error: { message: string } | null
    }
  if (error) throw new Error(error.message)
  return data
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

type AlertType = Notification['type']

const ALERT_META: Record<AlertType, { label: string; icon: IconName; intent: Intent }> = {
  low_stock:          { label: 'Low Stock',           icon: 'box',           intent: Intent.WARNING },
  expiry:             { label: 'Expiry Warning',       icon: 'warning-sign',  intent: Intent.WARNING },
  approval:           { label: 'Approval Required',    icon: 'tick-circle',   intent: Intent.PRIMARY },
  system:             { label: 'System',               icon: 'notifications', intent: Intent.NONE    },
  predicted_outage:   { label: 'Predicted Outage',     icon: 'trending-down', intent: Intent.DANGER  },
  waste_alert:        { label: 'Waste Alert',          icon: 'shield',        intent: Intent.WARNING },
  consumption_spike:  { label: 'Consumption Spike',    icon: 'flash',         intent: Intent.WARNING },
  price_drift:        { label: 'Price Drift',          icon: 'document',      intent: Intent.PRIMARY },
  pos_variance:       { label: 'POS Variance',         icon: 'document',      intent: Intent.PRIMARY },
  po_discrepancy:     { label: 'PO Discrepancy',       icon: 'truck',         intent: Intent.DANGER  },
  contract_expiry:    { label: 'Contract Expiring',    icon: 'document',      intent: Intent.PRIMARY },
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AlertObjectPage() {
  const { alertId } = useParams<{ alertId: string }>()
  const navigate    = useNavigate()

  const { data: alert, isLoading, error } = useQuery({
    queryKey:  ['alert-object', alertId],
    queryFn:   () => fetchAlert(alertId ?? ''),
    enabled:   !!alertId,
    staleTime: 60_000,
  })

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
        Loading alert…
      </div>
    )
  }

  if (error || !alert) {
    return (
      <NonIdealState
        icon="warning-sign"
        title="Alert not found"
        description="Alert not found or access denied."
        action={
          <Button variant="minimal" intent={Intent.PRIMARY} onClick={() => { void navigate(-1) }}>
            ← Go back
          </Button>
        }
      />
    )
  }

  const meta       = ALERT_META[alert.type]
  const variantId  = alert.variant_id ?? alert.product_variants?.id ?? null
  const pv         = alert.product_variants
  const productName = pv?.products?.name ?? null
  const variantLabel = productName && pv ? `${productName} · ${pv.name}` : pv?.name ?? null

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
              <div className="flex h-9 w-9 items-center justify-center rounded shrink-0 bg-muted/40">
                <Icon icon={meta.icon} size={20} intent={meta.intent} />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Tag icon={meta.icon} intent={meta.intent} minimal>{meta.label}</Tag>
                  {alert.read ? (
                    <span className="text-[10px] text-muted-foreground">Read</span>
                  ) : (
                    <span className="text-[10px] font-bold text-primary">Unread</span>
                  )}
                </div>
                <p className="mt-1 text-sm font-medium text-foreground leading-snug">{alert.message}</p>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  {variantId && variantLabel && (
                    <Link to={`/variant/${variantId}`} className="flex items-center gap-1 hover:text-foreground hover:underline">
                      <Icon icon="box" size={12} />
                      {variantLabel}
                    </Link>
                  )}
                  <span>{formatDistanceToNow(new Date(alert.timestamp), { addSuffix: true })}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 max-w-3xl">

        {/* Message card */}
        <Card compact>
          <p className="text-[10px] font-bold uppercase tracking-widest opacity-70 mb-2">{meta.label}</p>
          <p className="text-sm leading-relaxed">{alert.message}</p>
        </Card>

        {/* Stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Card compact>
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Status</div>
            <div className={cn('text-sm font-semibold', alert.read ? 'text-muted-foreground' : 'text-primary')}>
              {alert.read ? 'Read' : 'Unread'}
            </div>
          </Card>
          <Card compact>
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Triggered</div>
            <div className="text-xs font-medium">{format(new Date(alert.timestamp), 'dd MMM yyyy')}</div>
            <div className="text-[10px] text-muted-foreground">{format(new Date(alert.timestamp), 'HH:mm')}</div>
          </Card>
          <Card compact>
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Type</div>
            <div className="text-xs font-medium">{meta.label}</div>
          </Card>
        </div>

        {/* Variant context */}
        {pv && variantId && (
          <Card compact className="!p-0">
            <div className="px-4 py-2.5 border-b">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Related Variant</p>
            </div>
            <Link
              to={`/variant/${variantId}`}
              className="flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
            >
              <div>
                <p className="text-sm font-medium">{variantLabel}</p>
                <p className="text-[10px] font-mono text-muted-foreground">{pv.sku}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={cn(
                  'text-sm font-bold tabular-nums',
                  pv.current_stock === 0 ? 'text-red-600' : 'text-foreground',
                )}>
                  {pv.current_stock} in stock
                </span>
                <Icon icon="chevron-right" size={14} className="text-muted-foreground/40" />
              </div>
            </Link>
          </Card>
        )}

        {/* Dismissal reason */}
        {alert.dismissed_reason && (
          <Card compact className="!bg-muted/20">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Dismissal Reason</p>
            <p className="text-xs text-foreground leading-relaxed">{alert.dismissed_reason}</p>
          </Card>
        )}

        {/* Metadata */}
        <Card compact className="!p-0 divide-y text-xs">
          <div className="flex items-center justify-between px-4 py-2.5">
            <span className="text-muted-foreground">Alert ID</span>
            <span className="font-mono text-[10px]">{alert.id}</span>
          </div>
          <div className="flex items-center justify-between px-4 py-2.5">
            <span className="text-muted-foreground">User</span>
            <span className="font-mono text-[10px]">{alert.user_id}</span>
          </div>
        </Card>
      </div>
    </div>
  )
}
