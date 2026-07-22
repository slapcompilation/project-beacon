// Finance signals on the Home briefing — over-budget categories + CPOR spikes,
// fired by the tunable finance monitors. Renders nothing when all clear, so it
// only appears when there's a decision to make (not a standing dashboard).

import { Card, Icon } from '@blueprintjs/core'
import { Link } from 'react-router-dom'
import { useFinanceSignals } from './useFinanceSignals'

export function FinanceSignalsSection() {
  const signals = useFinanceSignals()
  if (signals.length === 0) return null

  return (
    <Card className="!p-0 overflow-hidden divide-y">
      <p className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground bg-muted/30">
        Finance · {signals.length}
      </p>
      {signals.map((s) => (
        <Link
          key={s.id}
          to={s.to}
          className="flex items-center gap-3 px-4 py-3 no-underline transition-colors hover:bg-muted/30"
        >
          <Icon icon={s.kind === 'budget' ? 'bank-account' : 'chart'} size={14} className="shrink-0 text-amber-600" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-foreground">{s.label}</p>
            <p className="truncate text-xs text-muted-foreground">{s.detail}</p>
          </div>
          <Icon icon="chevron-right" size={14} className="shrink-0 text-muted-foreground" />
        </Link>
      ))}
    </Card>
  )
}
