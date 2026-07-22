// Insights overview — the lens directory. The six analytical panels are all
// live and useful; what was missing was a statement of what Insights IS and
// what each lens answers. Cards generated from LENSES (shared with the tab bar
// so labels can't drift); each navigates into its lens.

import { Card, Icon } from '@blueprintjs/core'
import type { IconName } from '@blueprintjs/icons'

export type LensGroup = 'Intelligence' | 'Analytics' | 'Finance'
export type LensId =
  | 'signals' | 'incidents' | 'waste' | 'risk' | 'performance' | 'occupancy'
  | 'team' | 'cpor' | 'budget' | 'gl' | 'fb' | 'chain'

export const LENSES: {
  id: LensId; label: string; icon: IconName; group: LensGroup; question: string
}[] = [
  { id: 'signals',     label: 'Signals',     icon: 'feed',                group: 'Intelligence', question: 'Everything demanding attention right now, ranked across waste, reliability, forecast and incidents.' },
  { id: 'incidents',   label: 'Incidents',   icon: 'search-around',       group: 'Intelligence', question: 'Correlated failures — what caused what, traced across the graph.' },
  { id: 'waste',       label: 'Waste Radar',  icon: 'trash',              group: 'Analytics',    question: 'Where units are being lost, how far above baseline, and by whom.' },
  { id: 'risk',        label: 'Risk Matrix',  icon: 'grid',               group: 'Analytics',    question: 'Stockout probability across the catalogue — what will run out first.' },
  { id: 'performance', label: 'Performance',  icon: 'chart',              group: 'Analytics',    question: 'Which products move and which drag — value, velocity, margin.' },
  { id: 'occupancy',   label: 'Occupancy',    icon: 'timeline-area-chart', group: 'Analytics',   question: 'Forward demand from bookings — occupancy-adjusted consumption ahead.' },
  { id: 'team',        label: 'Team',         icon: 'people',             group: 'Analytics',    question: 'Per-member waste attribution and outlier detection, benchmarked across the team.' },
  { id: 'cpor',        label: 'CPOR',         icon: 'bank-account',       group: 'Finance',      question: 'Cost per occupied room — the P&L number, trended period on period.' },
  { id: 'budget',      label: 'Budget',       icon: 'bank-account',       group: 'Finance',      question: 'Spend vs allocation by category — what’s over, and how much runway is left.' },
  { id: 'fb',          label: 'F&B Intel',    icon: 'shop',              group: 'Finance',      question: 'Dish COGS and where stock disappears faster than POS explains — margin and theft.' },
  { id: 'gl',          label: 'GL Export',    icon: 'th',                 group: 'Finance',      question: 'Map categories to GL codes and export the period to the ledger.' },
  { id: 'chain',       label: 'Chain',        icon: 'graph',              group: 'Finance',      question: 'Which property needs attention now, benchmarked against the chain median (owner).' },
]

const GROUP_BLURB: Record<LensGroup, string> = {
  Intelligence: 'What is happening — the operation’s live signals and how failures connect.',
  Analytics:    'What is at risk and what performs — the analytical views over stock, demand and waste.',
  Finance:      'The money view — cost per room, budgets, F&B margin, ledger export and the chain picture.',
}

export function InsightsOverview({ onOpen }: { onOpen: (id: LensId) => void }) {
  const groups = ['Intelligence', 'Analytics', 'Finance'] as const
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-8 py-6 max-w-4xl space-y-6">
        <header>
          <h1 className="text-xl font-semibold">Insights</h1>
          <p className="text-sm text-muted-foreground mt-0.5 max-w-2xl">
            Read-only lenses over your operation — what’s happening and what’s at risk. Nothing here
            is acted on directly; each lens links into <b>Decisions</b>, where the agents propose and
            you approve.
          </p>
        </header>

        {groups.map((g) => (
          <section key={g} className="space-y-2">
            <div>
              <h2 className="text-sm font-semibold">{g}</h2>
              <p className="text-xs text-muted-foreground max-w-2xl">{GROUP_BLURB[g]}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {LENSES.filter((l) => l.group === g).map((l) => (
                <Card key={l.id} interactive compact onClick={() => { onOpen(l.id) }}>
                  <div className="flex items-center gap-2">
                    <Icon icon={l.icon} size={13} className="text-violet-500" />
                    <span className="text-sm font-semibold">{l.label}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1 leading-snug">{l.question}</p>
                </Card>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
