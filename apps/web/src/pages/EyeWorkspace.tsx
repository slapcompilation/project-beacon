// Insights — read-only lenses over the operation. The route is /eye (historic);
// the surface identity is "Insights" (what the sidebar calls it). Six live
// analytical panels, fronted by an Overview that states what each lens answers
// and how Insights relates to Decisions.
//
// Palantir principle #4: decision support, not data display. Every lens links
// into Decisions where the operator acts.

import { lazy, Suspense, useEffect } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { PanelErrorBoundary } from '@/components/PanelErrorBoundary'
import { WorkspaceTabs, PanelLoader } from '@/components/WorkspaceTabs'
import { useAppStore } from '@/stores/app.store'
import { InsightsOverview, LENSES, type LensId } from '@/features/eye/InsightsOverview'

const UnifiedSignalsPage      = lazy(() => import('./UnifiedSignalsPage'))
const IncidentCorrelationPage = lazy(() => import('./IncidentCorrelationPage'))
const WasteRadarPage          = lazy(() => import('./WasteRadarPage'))
const ProductPerformancePage  = lazy(() => import('./ProductPerformancePage'))
const OccupancyForecastPage   = lazy(() => import('./OccupancyForecastPage'))
const StockRiskMatrixPage     = lazy(() => import('./StockRiskMatrixPage'))

// Overview first; the six lenses derive from the shared registry so labels and
// grouping can't drift between the cards and the tab bar.
const TABS = [{ id: 'overview', label: 'Overview' }, ...LENSES.map((l) => ({ id: l.id, label: l.label }))] as const
type TabId = typeof TABS[number]['id']

const GROUPS = [
  { id: 'start',        label: 'Overview',     tabs: ['overview'] as TabId[] },
  { id: 'intelligence', label: 'Intelligence', tabs: LENSES.filter((l) => l.group === 'Intelligence').map((l) => l.id) as TabId[] },
  { id: 'analytics',    label: 'Analytics',    tabs: LENSES.filter((l) => l.group === 'Analytics').map((l) => l.id) as TabId[] },
]

export default function EyeWorkspace() {
  const [params, setParams] = useSearchParams()
  const toggleCopilot = useAppStore((s) => s.toggleCopilot)
  const raw   = params.get('panel') ?? 'overview'

  // Redirect legacy ?panel=copilot URLs to open the ContextPanel copilot instead
  useEffect(() => {
    if (raw === 'copilot') {
      toggleCopilot()
      setParams({ panel: 'overview' }, { replace: true })
    }
  }, [raw, toggleCopilot, setParams])

  // Predictive Restock retired — the restock_advisor agent now emits these as
  // proposals in the Review Queue (docs/AIP-RESTRUCTURE.md, slice 4).
  if (raw === 'restock') return <Navigate to="/mind?aip=queue" replace />

  const panel = (TABS.some((t) => t.id === raw) ? raw : 'overview') as TabId
  const open = (p: TabId) => { setParams({ panel: p }, { replace: true }) }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <WorkspaceTabs
        tabs={TABS}
        groups={GROUPS}
        activePanel={panel}
        onPanelChange={open}
      />

      <PanelErrorBoundary name={`Insights · ${panel}`}>
        <Suspense fallback={<PanelLoader />}>
          <div className="flex-1 overflow-hidden">
            {panel === 'overview'    && <InsightsOverview onOpen={(id: LensId) => { open(id) }} />}
            {panel === 'signals'     && <UnifiedSignalsPage />}
            {panel === 'incidents'   && <IncidentCorrelationPage />}
            {panel === 'waste'       && <WasteRadarPage />}
            {panel === 'risk'        && <StockRiskMatrixPage />}
            {panel === 'performance' && <ProductPerformancePage />}
            {panel === 'occupancy'   && <OccupancyForecastPage />}
          </div>
        </Suspense>
      </PanelErrorBoundary>
    </div>
  )
}
