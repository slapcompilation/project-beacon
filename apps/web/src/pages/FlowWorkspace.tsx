// Layer: Flow — Replenishment: the physical restock loop (timeline · receive ·
// deliveries · pick lists) + handover. Approvals and the approvals dashboard
// moved to the Decisions inbox ; legacy
// ?panel=approvals|dashboard redirect there so existing links keep working.

import { lazy, Suspense } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { PanelErrorBoundary } from '@/components/PanelErrorBoundary'
import { WorkspaceTabs, PanelLoader } from '@/components/WorkspaceTabs'

const FlowTimelinePage  = lazy(() => import('./FlowTimelinePage'))
const ReceivePage       = lazy(() => import('./ReceivePage'))
const DeliveryQueuePage = lazy(() => import('./DeliveryQueuePage'))
const PickListsPage     = lazy(() => import('./PickListsPage'))
const ShiftHandoverPage = lazy(() => import('./ShiftHandoverPage'))

const TABS = [
  { id: 'timeline',   label: 'Timeline'   },
  { id: 'receive',    label: 'Receive'    },
  { id: 'deliveries', label: 'Deliveries' },
  { id: 'picklists',  label: 'Pick Lists' },
  { id: 'handover',   label: 'Handover'   },
] as const

type TabId = typeof TABS[number]['id']

const GROUPS = [
  { id: 'movement', label: 'Movement', tabs: ['timeline', 'receive', 'deliveries'] as TabId[] },
  { id: 'queue',    label: 'Queue',    tabs: ['picklists', 'handover']             as TabId[] },
]

// Approvals + the approvals dashboard now live in the Decisions inbox.
const DECISIONS_REDIRECT: Record<string, string> = {
  approvals: '/mind?aip=restock-approvals',
  dashboard: '/mind?aip=queue',
}

export default function FlowWorkspace() {
  const [params, setParams] = useSearchParams()
  const raw = params.get('panel') ?? 'receive'

  const redirect = DECISIONS_REDIRECT[raw]
  if (redirect) return <Navigate to={redirect} replace />

  const panel = (TABS.some((t) => t.id === raw) ? raw : 'receive') as TabId

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <WorkspaceTabs
        title="Flow"
        tabs={TABS}
        groups={GROUPS}
        activePanel={panel}
        onPanelChange={(p) => { setParams({ panel: p }, { replace: true }) }}
      />

      <PanelErrorBoundary name={`Flow · ${panel}`}>
        <Suspense fallback={<PanelLoader />}>
          <div className="flex-1 overflow-hidden">
            {panel === 'timeline'   && <FlowTimelinePage />}
            {panel === 'receive'    && <ReceivePage />}
            {panel === 'deliveries' && <DeliveryQueuePage />}
            {panel === 'picklists'  && <PickListsPage />}
            {panel === 'handover'   && <ShiftHandoverPage />}
          </div>
        </Suspense>
      </PanelErrorBoundary>
    </div>
  )
}
