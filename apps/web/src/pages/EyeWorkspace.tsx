// Layer: Eye — Consolidated intelligence workspace
// Replaces separate: /waste-radar, /occupancy, /reports, /alerts as nav items
// Tabs: Signals | Forecasts | Analytics

import { useSearchParams } from 'react-router-dom'
import { cn } from '@/lib/utils'
import WasteRadarPage from './WasteRadarPage'
import OccupancyForecastPage from './OccupancyForecastPage'
import ReportsPage from './ReportsPage'
import AlertsPage from './AlertsPage'
import PredictiveRestockPage from './PredictiveRestockPage'
import MonitorPage from './MonitorPage'
import StockRiskMatrixPage from './StockRiskMatrixPage'
import SimulationCockpitPage from './SimulationCockpitPage'
import AdaptivePARPage from './AdaptivePARPage'
import ProductPerformancePage from './ProductPerformancePage'

const TABS = [
  { id: 'signals',     label: 'Waste & Signals' },
  { id: 'restock',     label: 'Restock Queue'   },
  { id: 'performance', label: 'Performance'     },
  { id: 'risk',        label: 'Risk Matrix'     },
  { id: 'par',         label: 'PAR Engine'      },
  { id: 'simulation',  label: 'Simulation'      },
  { id: 'live',        label: 'Live Feed'       },
  { id: 'forecasts',   label: 'Forecasts'       },
  { id: 'analytics',   label: 'Analytics'       },
  { id: 'alerts',      label: 'Alerts'          },
] as const

type TabId = typeof TABS[number]['id']

export default function EyeWorkspace() {
  const [params, setParams] = useSearchParams()
  const raw = params.get('panel') ?? 'signals'
  const panel: TabId = TABS.some((t) => t.id === raw) ? raw as TabId : 'signals'

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
        {panel === 'signals'     && <WasteRadarPage />}
        {panel === 'restock'     && <PredictiveRestockPage />}
        {panel === 'performance' && <ProductPerformancePage />}
        {panel === 'risk'        && <StockRiskMatrixPage />}
        {panel === 'par'        && <AdaptivePARPage />}
        {panel === 'simulation' && <SimulationCockpitPage />}
        {panel === 'live'       && <MonitorPage />}
        {panel === 'forecasts' && <OccupancyForecastPage />}
        {panel === 'analytics' && <ReportsPage />}
        {panel === 'alerts'    && <AlertsPage />}
      </div>
    </div>
  )
}
