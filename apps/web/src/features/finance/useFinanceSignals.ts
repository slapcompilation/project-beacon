// Finance signals (P2) — the CPOR/Budget surfaces as tunable monitor signals for
// the Home briefing, not dashboard tabs. Metric comes from the same RPCs the
// Finance pages use; the trigger is the operator's rule in org policy.

import { useMemo } from 'react'
import { selectBudgetTriggers, selectCporTrigger, type BudgetReading } from '@beacon/reality-graph'
import { useBudgetVsActual, useCPORByPeriod } from '@/features/mind/hooks'
import { useMonitorPolicy } from '@/features/monitors/hooks'

export interface FinanceSignal {
  id:      string
  kind:    'budget' | 'cpor'
  label:   string
  detail:  string
  urgency: number
  to:      string
}

export function useFinanceSignals(): FinanceSignal[] {
  const { data: policy } = useMonitorPolicy()
  const now = new Date()
  const { data: budgetRows = [] } = useBudgetVsActual(now.getFullYear(), now.getMonth() + 1)
  const { data: cporRows = [] } = useCPORByPeriod(3)

  return useMemo(() => {
    if (!policy) return []
    const signals: FinanceSignal[] = []

    const budgetReadings: BudgetReading[] = budgetRows.map((r) => ({
      categoryId:   r.category_id,
      categoryName: r.category_name,
      spendPct:     r.spend_pct,
      actual:       r.actual_spend,
    }))
    for (const h of selectBudgetTriggers(budgetReadings, policy.merged.monitors.budget)) {
      signals.push({
        id:      `budget:${h.categoryId ?? h.categoryName}`,
        kind:    'budget',
        urgency: h.urgency,
        label:   `${h.categoryName} ${String(Math.round(h.overPct))}% over budget`,
        detail:  `€${Math.round(h.actual).toLocaleString()} spent this month`,
        to:      '/eye?panel=budget',
      })
    }

    const sorted = [...cporRows].sort((a, b) => a.period_start.localeCompare(b.period_start))
    const latest = sorted.length > 0 ? sorted[sorted.length - 1] : null
    const cporHit = selectCporTrigger(
      latest ? { periodLabel: latest.period_label, cpor: latest.cpor, changePct: latest.cpor_change_pct } : null,
      policy.merged.monitors.cpor,
    )
    if (cporHit) {
      signals.push({
        id:      'cpor:latest',
        kind:    'cpor',
        urgency: cporHit.urgency,
        label:   `CPOR up ${String(Math.round(cporHit.changePct))}% (${cporHit.periodLabel})`,
        detail:  `Now €${cporHit.cpor.toFixed(0)} per occupied room`,
        to:      '/eye?panel=cpor',
      })
    }

    return signals.sort((a, b) => b.urgency - a.urgency)
  }, [policy, budgetRows, cporRows])
}
