import { useState, useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  ChevronDown, Loader2, PackageCheck,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/currency'
import { useApproveRestockProposal } from '@/features/briefing/hooks'
import { useCreateRestockRequest } from '@/features/restock/hooks'
import { ACTION_CFG, BAND } from './constants'
import type { BriefingAction } from '@beacon/types'

export function ActionCard({ action, currency }: { action: BriefingAction; currency: string }) {
  const navigate        = useNavigate()
  const createRestock   = useCreateRestockRequest()
  const approveProposal = useApproveRestockProposal()
  const cfg  = ACTION_CFG[action.action_type]
  const Icon = cfg.icon
  const band = BAND(action.priority)

  const [restockExpanded, setRestockExpanded] = useState(false)
  const [restockDone, setRestockDone]         = useState(false)
  const [proposalDone, setProposalDone]       = useState(false)
  const [restockQty, setRestockQty]           = useState<number>(() => {
    if (action.action_type === 'low_stock_no_po') {
      const thr   = action.metadata.threshold   as number | undefined
      const stock = action.metadata.current_stock as number
      return thr != null ? Math.max(1, thr - stock) : 1
    }
    return 1
  })

  const handleApproveProposal = async () => {
    if (!action.entity_id) return
    const m = action.metadata
    try {
      await approveProposal.mutateAsync({
        variantId:    action.entity_id,
        qty:          m.suggested_qty    as number,
        supplierId:   m.preferred_supplier_id   as string,
        supplierName: m.preferred_supplier_name as string,
        unitCost:     (m.unit_cost  as number | null) ?? 0,
        leadDays:     Math.round((m.avg_lead_days as number | null) ?? 7),
      })
      setProposalDone(true)
      toast.success('Draft PO created — review in Procurement')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create PO')
    }
  }

  const metaLine = useMemo(() => {
    const m = action.metadata
    if (action.action_type === 'restock_proposal') {
      const qty  = m.suggested_qty           as number
      const supp = m.preferred_supplier_name as string
      const cost = m.unit_cost               as number | null
      const days = m.days_until_zero         as number
      return `${String(qty)} units from ${supp}`
        + (cost != null && cost > 0 ? ` · est. ${formatCurrency(qty * cost, currency)}` : '')
        + ` · ${String(Math.round(days))}d runway`
    }
    if (action.action_type === 'supplier_risk') {
      const tier    = m.urgency_tier      as string
      const score   = m.urgency_score     as number
      const reasons = m.reasons           as string[] | undefined
      const top     = reasons?.[0] ?? tier
      return `Score ${String(score)} · ${top}`
    }
    if (action.action_type === 'invoice_discrepancy') {
      const pct = m.variance_pct as number
      const inv = m.invoiced_value as number
      const rec = m.received_value as number
      return `${formatCurrency(inv, currency)} invoiced · ${formatCurrency(rec, currency)} received · ${pct.toFixed(1)}% gap`
    }
    if (action.action_type === 'low_stock_no_po' || action.action_type === 'low_stock_po_in_flight') {
      const stock = m.current_stock as number
      const thr   = m.threshold as number | undefined
      return thr != null ? `${String(stock)} / ${String(thr)} par` : `${String(stock)} units`
    }
    if (action.action_type === 'waste_spike_low_occupancy' || action.action_type === 'waste_spike_high_occupancy') {
      const pct = m.pct_above as number
      const occ = m.occupancy as number
      return `${String(pct)}% above weekly avg · ${String(occ)}% occupancy`
    }
    if (action.action_type === 'expiry_soon') {
      const val = m.value_at_risk as number
      return val > 0 ? `${formatCurrency(val, currency)} at risk` : null
    }
    if (action.action_type === 'gl_unmapped') {
      return `${String(m.unmapped_count)} items unmapped`
    }
    return `${String(m.total)} transactions ready`
  }, [action, currency])

  const objectUrl = action.entity_id
    ? (action.action_type === 'supplier_risk' || action.action_type === 'invoice_discrepancy')
      ? `/supplier/${action.entity_id}`
      : (action.action_type === 'gl_unmapped' || action.action_type === 'gl_period_ending')
      ? null
      : `/variant/${action.entity_id}`
    : null

  const handleNavigate = () => {
    const isWasteSpike =
      action.action_type === 'waste_spike_low_occupancy' ||
      action.action_type === 'waste_spike_high_occupancy'
    const url = isWasteSpike && action.entity_id ? '/timeline' : action.action_url
    void navigate(url, {
      state: {
        fromBriefing:    true,
        actionType:      action.action_type,
        entityLabel:     action.entity_label,
        entityId:        action.entity_id,
        focusVariantId:  isWasteSpike ? action.entity_id : undefined,
        focusLabel:      isWasteSpike ? action.entity_label : undefined,
      },
    })
  }

  const handleInlineRestock = async () => {
    if (!action.entity_id) return
    try {
      await createRestock.mutateAsync({
        variantId:     action.entity_id,
        quantityNeeded: restockQty,
        notes: `Requested from Briefing feed · ${new Date().toLocaleDateString()}`,
      })
      setRestockDone(true)
      setRestockExpanded(false)
      toast.success('Restock request created')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create request')
    }
  }

  return (
    <div className={cn(
      'px-5 py-3.5 border-b last:border-b-0 hover:bg-muted/30 transition-colors',
      band === 'act' && 'bg-red-50/30 dark:bg-red-950/10',
    )}>
      <div className="flex items-start gap-3">
        <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5',
          band === 'act'     ? 'bg-red-100 dark:bg-red-950/40' :
          band === 'monitor' ? 'bg-amber-100 dark:bg-amber-950/40' :
          'bg-muted',
        )}>
          <Icon className={cn('h-4 w-4', cfg.iconCls)} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {objectUrl
              ? (
                <Link
                  to={objectUrl}
                  className="text-sm font-semibold leading-snug hover:underline"
                  onClick={(e) => { e.stopPropagation() }}
                >
                  {action.entity_label}
                </Link>
              )
              : <span className="text-sm font-semibold leading-snug">{action.entity_label}</span>
            }
            {cfg.groupHint && (
              <Badge variant="outline" className="text-[10px] h-4 px-1 py-0 font-normal text-muted-foreground">
                {cfg.groupHint}
              </Badge>
            )}
            {restockDone && (
              <Badge className="text-[10px] h-4 px-1 py-0 bg-green-100 text-green-700 border-green-200">
                Requested
              </Badge>
            )}
            {proposalDone && (
              <Badge className="text-[10px] h-4 px-1 py-0 bg-green-100 text-green-700 border-green-200">
                PO Created
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{action.context}</p>
          {metaLine && (
            <p className={cn(
              'text-xs font-medium mt-1 tabular-nums',
              band === 'act'     ? 'text-red-700 dark:text-red-400' :
              band === 'monitor' ? 'text-amber-700 dark:text-amber-400' :
              'text-muted-foreground',
            )}>
              {metaLine}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
          {action.action_type === 'low_stock_no_po' && !restockDone && (
            <Button
              size="sm"
              variant="outline"
              className="text-xs h-7 px-2.5 border-red-200 text-red-700 hover:bg-red-50 dark:border-red-900/40 dark:text-red-400"
              onClick={() => { setRestockExpanded((v) => !v) }}
            >
              Quick restock
              <ChevronDown className={cn('h-3 w-3 ml-0.5 transition-transform', restockExpanded && 'rotate-180')} />
            </Button>
          )}
          {action.action_type === 'restock_proposal' && !proposalDone && (
            <Button
              size="sm"
              className="text-xs h-7 px-2.5 gap-1 bg-green-600 hover:bg-green-700 text-white"
              disabled={approveProposal.isPending}
              onClick={() => { void handleApproveProposal() }}
            >
              {approveProposal.isPending
                ? <Loader2 className="h-3 w-3 animate-spin" />
                : <><PackageCheck className="h-3 w-3" />Approve & Create PO</>
              }
            </Button>
          )}
          {action.action_type === 'restock_proposal' && proposalDone && (
            <Button
              size="sm"
              variant="outline"
              className="text-xs h-7 px-2.5"
              onClick={() => { void navigate('/procurement?tab=saved') }}
            >
              View PO
            </Button>
          )}
          {action.action_type !== 'restock_proposal' && (
            <Button
              size="sm"
              variant={band === 'act' ? 'default' : 'outline'}
              className={cn(
                'text-xs h-7 px-2.5',
                band === 'act'     ? 'bg-red-600 hover:bg-red-700 text-white' :
                band === 'monitor' ? 'border-amber-300 text-amber-700 hover:bg-amber-50' : '',
              )}
              onClick={handleNavigate}
            >
              {action.action_label}
            </Button>
          )}
        </div>
      </div>

      {restockExpanded && action.action_type === 'low_stock_no_po' && (
        <div className="mt-3 ml-11 flex items-center gap-2 p-3 rounded-lg bg-muted/40 border border-red-100 dark:border-red-900/30">
          <label className="text-xs text-muted-foreground shrink-0">Qty to request:</label>
          <input
            type="number"
            min={1}
            value={restockQty}
            onChange={(e) => { setRestockQty(Math.max(1, Number(e.target.value))) }}
            className="w-20 h-7 rounded border border-input bg-background px-2 text-xs tabular-nums focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <p className="text-[10px] text-muted-foreground flex-1">
            Pre-filled: par − current stock
            {action.metadata.days_left != null && ` · ~${String(action.metadata.days_left as number)}d at current rate`}
          </p>
          <Button
            size="sm"
            className="h-7 text-xs bg-red-600 hover:bg-red-700 text-white"
            disabled={createRestock.isPending}
            onClick={() => { void handleInlineRestock() }}
          >
            {createRestock.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Confirm'}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs text-muted-foreground"
            onClick={() => { setRestockExpanded(false) }}
          >
            Cancel
          </Button>
        </div>
      )}
    </div>
  )
}
