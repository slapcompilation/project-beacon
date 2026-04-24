import { useState, useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Activity, Loader2, PackageCheck } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/currency'
import { useBriefingActions, useApproveRestockProposal } from '@/features/briefing/hooks'

export function ProposalsPanel({ currency }: { currency: string }) {
  const navigate           = useNavigate()
  const { data: actions = [] } = useBriefingActions()
  const approveProposal    = useApproveRestockProposal()

  const proposals = useMemo(
    () => actions.filter((a) => a.action_type === 'restock_proposal'),
    [actions],
  )

  const [approving,     setApproving]     = useState(false)
  const [approvedCount, setApprovedCount] = useState(0)
  const [allDone,       setAllDone]       = useState(false)
  const [donedIds, setDoneIds] = useState<Set<string>>(new Set())

  const estimatedTotal = useMemo(() =>
    proposals.reduce((sum, p) => {
      const qty  = p.metadata.suggested_qty as number
      const cost = (p.metadata.unit_cost as number | null) ?? 0
      return sum + qty * cost
    }, 0),
    [proposals],
  )

  const handleApproveAll = async () => {
    setApproving(true)
    setApprovedCount(0)
    let approved = 0
    for (const p of proposals) {
      if (!p.entity_id || donedIds.has(p.entity_id)) continue
      const m = p.metadata
      try {
        await approveProposal.mutateAsync({
          variantId:    p.entity_id,
          qty:          m.suggested_qty           as number,
          supplierId:   m.preferred_supplier_id   as string,
          supplierName: m.preferred_supplier_name as string,
          unitCost:     (m.unit_cost as number | null) ?? 0,
          leadDays:     Math.round((m.avg_lead_days as number | null) ?? 7),
        })
        approved++
        setApprovedCount((n) => n + 1)
        if (p.entity_id) setDoneIds((prev) => new Set([...prev, p.entity_id ?? '']))
      } catch {
        // Skip failed; continue with the rest
      }
    }
    setAllDone(true)
    setApproving(false)
    if (approved > 0) toast.success(`${String(approved)} draft PO${approved > 1 ? 's' : ''} created — review in Procurement`)
  }

  if (proposals.length === 0) return null

  const pendingCount = proposals.filter((p) => p.entity_id && !donedIds.has(p.entity_id)).length

  return (
    <div className="rounded-lg border border-green-200 dark:border-green-900/50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-green-50/60 dark:bg-green-950/20 border-b border-green-100 dark:border-green-900/30">
        <Activity className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-green-700 dark:text-green-400 uppercase tracking-widest">
            {proposals.length} Autonomous Proposal{proposals.length > 1 ? 's' : ''} Ready
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            System-generated from consumption trends · one-tap approval creates draft POs
            {estimatedTotal > 0 && ` · est. ${formatCurrency(estimatedTotal, currency)} total`}
          </p>
        </div>

        {allDone ? (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs shrink-0"
            onClick={() => { void navigate('/mind?panel=procurement') }}
          >
            View Procurement →
          </Button>
        ) : (
          <Button
            size="sm"
            className="h-7 text-xs shrink-0 gap-1.5 bg-green-600 hover:bg-green-700 text-white"
            disabled={approving || pendingCount === 0}
            onClick={() => { void handleApproveAll() }}
          >
            {approving ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                {approvedCount}/{pendingCount}…
              </>
            ) : (
              <>
                <PackageCheck className="h-3 w-3" />
                Approve All {pendingCount > 1 ? `${String(pendingCount)} ` : ''}& Create POs
              </>
            )}
          </Button>
        )}
      </div>

      {/* Proposal rows */}
      <div className="divide-y">
        {proposals.map((p) => {
          const m         = p.metadata
          const qty       = m.suggested_qty           as number
          const supplier  = m.preferred_supplier_name as string
          const cost      = (m.unit_cost as number | null) ?? 0
          const days      = Math.round(m.days_until_zero as number)
          const leadDays  = Math.round((m.avg_lead_days as number | null) ?? 7)
          const isDone    = p.entity_id != null && donedIds.has(p.entity_id)

          return (
            <div key={p.entity_id ?? ''} className={cn('flex items-center gap-3 px-4 py-3', isDone && 'opacity-50')}>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold leading-snug truncate">
                  {p.entity_id
                    ? <Link to={`/variant/${p.entity_id}`} className="hover:underline" onClick={(e) => { e.stopPropagation() }}>{p.entity_label}</Link>
                    : p.entity_label
                  }
                  {isDone && (
                    <span className="ml-2 text-[9px] font-bold uppercase tracking-wide text-green-600 dark:text-green-400">PO Created</span>
                  )}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5 tabular-nums">
                  {qty} units from {supplier}
                  {cost > 0 && ` · est. ${formatCurrency(qty * cost, currency)}`}
                  {` · ${String(days)}d runway · ${String(leadDays)}d lead time`}
                </p>
              </div>
              {!isDone && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 text-[10px] px-2 shrink-0 border-green-200 dark:border-green-900/50 text-green-700 dark:text-green-400 hover:bg-green-50"
                  disabled={approving}
                  onClick={() => {
                    void approveProposal.mutateAsync({
                      variantId:    p.entity_id ?? '',
                      qty,
                      supplierId:   m.preferred_supplier_id   as string,
                      supplierName: supplier,
                      unitCost:     cost,
                      leadDays,
                    }).then(() => {
                      if (p.entity_id) setDoneIds((prev) => new Set([...prev, p.entity_id ?? '']))
                      toast.success('Draft PO created')
                    }).catch(() => { toast.error('Failed to create PO') })
                  }}
                >
                  Approve
                </Button>
              )}
            </div>
          )
        })}
      </div>
      <div className="px-4 py-2 border-t bg-muted/10">
        <p className="text-[10px] text-muted-foreground/60">
          Based on 30-day avg consumption · lead times from supplier records · excludes items with open POs
        </p>
      </div>
    </div>
  )
}
