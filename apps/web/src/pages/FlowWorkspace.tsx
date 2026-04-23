// Layer: Flow — Consolidated operational movement workspace
// Two groups:
//   Movement — Timeline (immutable ledger) · Receive · Deliveries
//   Queue    — Approvals (restock) · Pick Lists · Handover
// Analytical tools (Causal Chain, Graph, Stocktake analysis) remain as utility
// routes accessible from within object pages and the causal chain deeplinks.

import { useSearchParams } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { PanelErrorBoundary } from '@/components/PanelErrorBoundary'
import FlowTimelinePage from './FlowTimelinePage'
import ReceivePage from './ReceivePage'
import RestockPage from './RestockPage'
import DeliveryQueuePage from './DeliveryQueuePage'
import ShiftHandoverPage from './ShiftHandoverPage'
import PickListsPage from './PickListsPage'

const TABS = [
  { id: 'timeline',   label: 'Timeline'   },
  { id: 'receive',    label: 'Receive'    },
  { id: 'deliveries', label: 'Deliveries' },
  { id: 'approvals',  label: 'Approvals'  },
  { id: 'picklists',  label: 'Pick Lists' },
  { id: 'handover',   label: 'Handover'   },
] as const

type TabId = typeof TABS[number]['id']

const GROUPS: { id: string; label: string; tabs: TabId[] }[] = [
  { id: 'movement', label: 'Movement', tabs: ['timeline', 'receive', 'deliveries'] },
  { id: 'queue',    label: 'Queue',    tabs: ['approvals', 'picklists', 'handover'] },
]

export default function FlowWorkspace() {
  const [params, setParams] = useSearchParams()
  const raw = params.get('panel') ?? 'timeline'
  const panel: TabId = TABS.some((t) => t.id === raw) ? raw as TabId : 'timeline'

  const activeGroup = GROUPS.find((g) => g.tabs.includes(panel)) ?? GROUPS[0]

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Group selector */}
      <div className="flex items-center gap-1 px-3 py-2 border-b shrink-0 bg-background">
        {GROUPS.map((g) => (
          <button
            key={g.id}
            type="button"
            onClick={() => { setParams({ panel: g.tabs[0] }, { replace: true }) }}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
              g.id === activeGroup.id
                ? 'bg-primary/10 text-primary border border-primary/30'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted',
            )}
          >
            {g.label}
          </button>
        ))}
      </div>

      {/* Sub-tabs */}
      <div className="flex border-b shrink-0 bg-background">
        {activeGroup.tabs.map((tabId) => {
          const tab = TABS.find((t) => t.id === tabId)!
          return (
            <button
              key={tabId}
              type="button"
              onClick={() => { setParams({ panel: tabId }, { replace: true }) }}
              className={cn(
                'px-4 py-2 text-xs font-medium border-b-2 transition-colors -mb-px',
                panel === tabId
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      <PanelErrorBoundary name={`Flow · ${panel}`}>
        <div className="flex-1 overflow-hidden">
          {panel === 'timeline'   && <FlowTimelinePage />}
          {panel === 'receive'    && <ReceivePage />}
          {panel === 'deliveries' && <DeliveryQueuePage />}
          {panel === 'approvals'  && <RestockPage />}
          {panel === 'picklists'  && <PickListsPage />}
          {panel === 'handover'   && <ShiftHandoverPage />}
        </div>
      </PanelErrorBoundary>
    </div>
  )
}
