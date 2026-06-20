// Layer: Eye — Consolidated intelligence workspace
// Two groups:
//   Intelligence — Signals | Incidents
//   Analytics    — Waste Radar | Predictive Restock | Product Performance | Occupancy Forecast
//
// Copilot has been promoted to the omnipresent ContextPanel (Ctrl+J).
// Palantir principle #4: decision support, not data display.
// Every panel answers "what should the operator do right now?"

import { lazy, Suspense, useEffect } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { PanelErrorBoundary } from '@/components/PanelErrorBoundary'
import { WorkspaceTabs, PanelLoader } from '@/components/WorkspaceTabs'
import { useAppStore } from '@/stores/app.store'

const UnifiedSignalsPage      = lazy(() => import('./UnifiedSignalsPage'))
const IncidentCorrelationPage = lazy(() => import('./IncidentCorrelationPage'))
const WasteRadarPage          = lazy(() => import('./WasteRadarPage'))
const ProductPerformancePage  = lazy(() => import('./ProductPerformancePage'))
const OccupancyForecastPage   = lazy(() => import('./OccupancyForecastPage'))
const StockRiskMatrixPage     = lazy(() => import('./StockRiskMatrixPage'))

const TABS = [
  { id: 'signals',     label: 'Signals'     },
  { id: 'incidents',   label: 'Incidents'   },
  { id: 'waste',       label: 'Waste Radar' },
  { id: 'risk',        label: 'Risk Matrix' },
  { id: 'performance', label: 'Performance' },
  { id: 'occupancy',   label: 'Occupancy'   },
] as const

type TabId = typeof TABS[number]['id']

const GROUPS = [
  { id: 'intelligence', label: 'Intelligence', tabs: ['signals', 'incidents']                                   as TabId[] },
  { id: 'analytics',    label: 'Analytics',    tabs: ['waste', 'risk', 'performance', 'occupancy']             as TabId[] },
]

export default function EyeWorkspace() {
  const [params, setParams] = useSearchParams()
  const toggleCopilot = useAppStore((s) => s.toggleCopilot)
  const raw   = params.get('panel') ?? 'signals'

  // Redirect legacy ?panel=copilot URLs to open the ContextPanel copilot instead
  useEffect(() => {
    if (raw === 'copilot') {
      toggleCopilot()
      setParams({ panel: 'signals' }, { replace: true })
    }
  }, [raw, toggleCopilot, setParams])

  // Predictive Restock retired — the restock_advisor agent now emits these as
  // proposals in the Review Queue (docs/AIP-RESTRUCTURE.md, slice 4).
  if (raw === 'restock') return <Navigate to="/mind?aip=queue" replace />

  const panel = (TABS.some((t) => t.id === raw) ? raw : 'signals') as TabId

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <WorkspaceTabs
        tabs={TABS}
        groups={GROUPS}
        activePanel={panel}
        onPanelChange={(p) => { setParams({ panel: p }, { replace: true }) }}
      />

      <PanelErrorBoundary name={`Eye · ${panel}`}>
        <Suspense fallback={<PanelLoader />}>
          <div className="flex-1 overflow-hidden">
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
