// Layer: Flow — Consolidated operational movement workspace
// Two groups:
//   Movement — Dashboard · Timeline (immutable ledger) · Receive · Deliveries
//   Queue    — Approvals (restock) · Pick Lists · Handover

import { lazy, Suspense } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PanelErrorBoundary } from '@/components/PanelErrorBoundary'
import { WorkspaceTabs, PanelLoader } from '@/components/WorkspaceTabs'

const FlowDashboardPage = lazy(() => import('./FlowDashboardPage'))
const FlowTimelinePage  = lazy(() => import('./FlowTimelinePage'))
const ReceivePage       = lazy(() => import('./ReceivePage'))
const DeliveryQueuePage = lazy(() => import('./DeliveryQueuePage'))
const RestockPage       = lazy(() => import('./RestockPage'))
const PickListsPage     = lazy(() => import('./PickListsPage'))
const ShiftHandoverPage = lazy(() => import('./ShiftHandoverPage'))

const TABS = [
  { id: 'dashboard',  label: 'Dashboard'  },
  { id: 'timeline',   label: 'Timeline'   },
  { id: 'receive',    label: 'Receive'    },
  { id: 'deliveries', label: 'Deliveries' },
  { id: 'approvals',  label: 'Approvals'  },
  { id: 'picklists',  label: 'Pick Lists' },
  { id: 'handover',   label: 'Handover'   },
] as const

type TabId = typeof TABS[number]['id']

const GROUPS = [
  { id: 'movement', label: 'Movement', tabs: ['dashboard', 'timeline', 'receive', 'deliveries'] as TabId[] },
  { id: 'queue',    label: 'Queue',    tabs: ['approvals', 'picklists', 'handover']              as TabId[] },
]

export default function FlowWorkspace() {
  const [params, setParams] = useSearchParams()
  const raw   = params.get('panel') ?? 'dashboard'
  const panel = (TABS.some((t) => t.id === raw) ? raw : 'dashboard') as TabId

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <WorkspaceTabs
        tabs={TABS}
        groups={GROUPS}
        activePanel={panel}
        onPanelChange={(p) => { setParams({ panel: p }, { replace: true }) }}
      />

      <PanelErrorBoundary name={`Flow · ${panel}`}>
        <Suspense fallback={<PanelLoader />}>
          <div className="flex-1 overflow-hidden">
            {panel === 'dashboard'  && <FlowDashboardPage />}
            {panel === 'timeline'   && <FlowTimelinePage />}
            {panel === 'receive'    && <ReceivePage />}
            {panel === 'deliveries' && <DeliveryQueuePage />}
            {panel === 'approvals'  && <RestockPage />}
            {panel === 'picklists'  && <PickListsPage />}
            {panel === 'handover'   && <ShiftHandoverPage />}
          </div>
        </Suspense>
      </PanelErrorBoundary>
    </div>
  )
}
