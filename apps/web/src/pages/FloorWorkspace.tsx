// Layer: Floor — Live stock reality + alerts for managers
// Note: scan/barcode workflow stays in ScanLayout (/scan) for floor staff

import { lazy, Suspense } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { PanelErrorBoundary } from '@/components/PanelErrorBoundary'
import { WorkspaceTabs, PanelLoader } from '@/components/WorkspaceTabs'

const InventoryPage          = lazy(() => import('./InventoryPage'))
const LocationInventoryPage  = lazy(() => import('./LocationInventoryPage'))
const AdaptivePARPage        = lazy(() => import('./AdaptivePARPage'))
const PendingScansPage       = lazy(() => import('./PendingScansPage'))
const AlertsPage             = lazy(() => import('./AlertsPage'))
const ExpiryPage             = lazy(() => import('./ExpiryPage'))
const ShiftHandoverPage      = lazy(() => import('./ShiftHandoverPage'))
const PhotoStocktakePage     = lazy(() => import('./PhotoStocktakePage'))
const VoiceModePage          = lazy(() => import('./VoiceModePage'))

const TABS = [
  { id: 'stock',           label: 'Live Stock'   },
  { id: 'locations',       label: 'Locations'    },
  { id: 'par',             label: 'Adaptive PAR' },
  { id: 'scans',           label: 'Ghost Scans'  },
  { id: 'alerts',          label: 'Alerts'       },
  { id: 'expiry',          label: 'Expiry'       },
  { id: 'handover',        label: 'Handover'     },
  { id: 'photo-stocktake', label: 'Vision Scan'  },
  { id: 'voice',           label: 'Voice Mode'   },
] as const

type TabId = typeof TABS[number]['id']

const GROUPS = [
  { id: 'stock',   label: 'Stock',   tabs: ['stock', 'locations', 'par', 'scans'] as TabId[] },
  { id: 'signals', label: 'Signals', tabs: ['alerts', 'expiry']                   as TabId[] },
  { id: 'shift',   label: 'Shift',   tabs: ['handover']                           as TabId[] },
  { id: 'capture', label: 'Capture', tabs: ['photo-stocktake', 'voice']           as TabId[] },
]

export default function FloorWorkspace() {
  const [params, setParams] = useSearchParams()
  const raw   = params.get('panel') ?? 'stock'

  // Stocktake (+ its variance view) is deferred from the primary Floor tabs; it
  // lives at /stocktake now (variance folded in there). Keep old links working.
  if (raw === 'stocktake' || raw === 'stocktake-intel') return <Navigate to="/stocktake" replace />

  const panel = (TABS.some((t) => t.id === raw) ? raw : 'stock') as TabId

  // Realtime handled globally by useRealtimeSync in AppLayout

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <WorkspaceTabs
        title="Floor"
        tabs={TABS}
        groups={GROUPS}
        activePanel={panel}
        onPanelChange={(p) => { setParams({ panel: p }, { replace: true }) }}
      />

      <PanelErrorBoundary name={`Floor · ${panel}`}>
        <Suspense fallback={<PanelLoader />}>
          <div className="flex-1 overflow-hidden">
            {panel === 'stock'           && <InventoryPage />}
            {panel === 'locations'       && <LocationInventoryPage />}
            {panel === 'par'             && <AdaptivePARPage />}
            {panel === 'scans'           && <PendingScansPage />}
            {panel === 'alerts'          && <AlertsPage />}
            {panel === 'expiry'          && <ExpiryPage />}
            {panel === 'handover'        && <ShiftHandoverPage />}
            {panel === 'photo-stocktake' && <PhotoStocktakePage />}
            {panel === 'voice'           && <VoiceModePage />}
          </div>
        </Suspense>
      </PanelErrorBoundary>
    </div>
  )
}
