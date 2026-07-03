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
import { ObjectHeaderBand } from '@/components/ObjectHeaderBand'
import { MetricStrip, Metric } from '@/components/MetricStrip'
import { AuditRail } from '@/components/AuditRail'

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
  integration_health: { label: 'Data Feed',            icon: 'data-connection', intent: Intent.DANGER },
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
      <ObjectHeaderBand
        breadcrumb={{ label: 'Alerts', to: '/eye' }}
        icon={meta.icon}
        title={meta.label}
        star={{ id: `alert:${alert.id}`, label: meta.label, subtitle: 'Alert', path: `/alert/${alert.id}`, icon: meta.icon }}
        tags={<Tag minimal intent={alert.read ? Intent.NONE : Intent.PRIMARY}>{alert.read ? 'Read' : 'Unread'}</Tag>}
        id={alert.id}
      />

      <MetricStrip>
        <Metric label="Type" value={meta.label} />
        <Metric label="Triggered" value={format(new Date(alert.timestamp), 'dd MMM yyyy')} sub={format(new Date(alert.timestamp), 'HH:mm')} />
        <Metric label="Age" value={formatDistanceToNow(new Date(alert.timestamp), { addSuffix: true })} />
        <Metric label="Variant Stock" value={pv ? pv.current_stock : '—'} sub={pv?.sku ?? undefined} accent={pv && pv.current_stock === 0 ? 'red' : undefined} />
      </MetricStrip>

      <div className="flex-1 overflow-y-auto p-4 flex gap-4">
          <main className="flex-1 min-w-0 space-y-4">

        {/* Message card */}
        <Card compact>
          <p className="text-[10px] font-bold uppercase tracking-widest opacity-70 mb-2">{meta.label}</p>
          <p className="text-sm leading-relaxed">{alert.message}</p>
        </Card>

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
          </main>
          <AuditRail nodeType="alert" nodeId={alert.id} />
      </div>
    </div>
  )
}
