import { ChevronDown, ChevronRight } from 'lucide-react'
import { useProposalQualitySummary } from '@/features/eye/hooks'
import { useSectionCollapse } from './useSectionCollapse'
import { LayerDot } from './LayerDot'
import { MetricCard } from './MetricCard'

export function ProposalQualitySection() {
  const { data: summary, isLoading } = useProposalQualitySummary(90)
  const [open, setOpen] = useSectionCollapse('proposal-quality', false)

  if (isLoading || !summary || summary.total_proposals === 0) return null

  const dismissals = summary.dismissal_breakdown
  const totalDismissals = dismissals.not_needed + dismissals.wrong_qty + dismissals.wrong_timing + dismissals.wrong_supplier + dismissals.other + dismissals.expired

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <button
        type="button"
        onClick={() => { setOpen(!open) }}
        className="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-surface-2/50 transition-colors"
      >
        {open ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
        <LayerDot layer="eye" />
        <span className="text-sm font-medium flex-1">Proposal Quality</span>
        <span className="text-[10px] text-muted-foreground tabular-nums">{summary.total_proposals} proposals · 90d</span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <MetricCard label="Quality Score" value={summary.avg_quality_score != null ? `${(summary.avg_quality_score * 100).toFixed(0)}%` : '—'} />
            <MetricCard label="Approval Rate" value={summary.approval_rate != null ? `${(summary.approval_rate * 100).toFixed(0)}%` : '—'} />
            <MetricCard label="Auto-Approved" value={summary.auto_approval_rate != null ? `${(summary.auto_approval_rate * 100).toFixed(0)}%` : '—'} />
            <MetricCard label="Excess Waste" value={summary.excess_waste_rate != null ? `${(summary.excess_waste_rate * 100).toFixed(1)}%` : '—'} warn={summary.excess_waste_rate != null && summary.excess_waste_rate > 0.05} />
          </div>

          {totalDismissals > 0 && (
            <div className="text-xs space-y-1">
              <p className="text-muted-foreground font-medium">Dismissal reasons ({totalDismissals})</p>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
                {dismissals.not_needed > 0 && <span>Not needed: {dismissals.not_needed}</span>}
                {dismissals.wrong_qty > 0 && <span>Wrong qty: {dismissals.wrong_qty}</span>}
                {dismissals.wrong_timing > 0 && <span>Wrong timing: {dismissals.wrong_timing}</span>}
                {dismissals.wrong_supplier > 0 && <span>Wrong supplier: {dismissals.wrong_supplier}</span>}
                {dismissals.other > 0 && <span>Other: {dismissals.other}</span>}
                {dismissals.expired > 0 && <span>Expired: {dismissals.expired}</span>}
              </div>
            </div>
          )}

          {summary.variants_with_learned_thresholds > 0 && (
            <p className="text-[10px] text-muted-foreground/70">
              {summary.variants_with_learned_thresholds} variant{summary.variants_with_learned_thresholds !== 1 ? 's' : ''} with learned alert thresholds (confidence &gt;0.3)
            </p>
          )}
        </div>
      )}
    </div>
  )
}
