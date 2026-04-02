// Layer: Flow — Consolidated operational movement workspace
// Replaces separate: /timeline, /receive, /restocks routes as nav items
// Tabs: Timeline | Receive | Approvals | Graph

import { useSearchParams } from 'react-router-dom'
import { cn } from '@/lib/utils'
import FlowTimelinePage from './FlowTimelinePage'
import ReceivePage from './ReceivePage'
import RestockPage from './RestockPage'
import GraphPage from './GraphPage'
import StocktakeIntelligencePage from './StocktakeIntelligencePage'

const TABS = [
  { id: 'timeline',  label: 'Timeline'  },
  { id: 'receive',   label: 'Receive'   },
  { id: 'approvals', label: 'Approvals' },
  { id: 'stocktake', label: 'Stocktake' },
  { id: 'graph',     label: 'Graph'     },
] as const

type TabId = typeof TABS[number]['id']

export default function FlowWorkspace() {
  const [params, setParams] = useSearchParams()
  const raw = params.get('panel') ?? 'timeline'
  const panel: TabId = TABS.some((t) => t.id === raw) ? raw as TabId : 'timeline'

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex border-b shrink-0 bg-background">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => { setParams({ panel: t.id }, { replace: true }) }}
            className={cn(
              'px-5 py-3 text-sm font-medium border-b-2 transition-colors -mb-px',
              panel === t.id
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-hidden">
        {panel === 'timeline'  && <FlowTimelinePage />}
        {panel === 'receive'   && <ReceivePage />}
        {panel === 'approvals' && <RestockPage />}
        {panel === 'stocktake' && <StocktakeIntelligencePage />}
        {panel === 'graph'     && <GraphPage />}
      </div>
    </div>
  )
}
