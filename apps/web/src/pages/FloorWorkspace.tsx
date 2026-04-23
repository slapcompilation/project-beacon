// Layer: Floor — Live stock reality + alerts for managers
// Tabs: Live Stock | Alerts | Expiry
// Note: scan/barcode workflow stays in ScanLayout (/scan) for floor staff

import { useSearchParams } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useInventoryRealtime } from '@/features/inventory/hooks'
import { PanelErrorBoundary } from '@/components/PanelErrorBoundary'
import InventoryPage from './InventoryPage'
import AlertsPage from './AlertsPage'
import ExpiryPage from './ExpiryPage'
import StocktakePage from './StocktakePage'
import LocationInventoryPage from './LocationInventoryPage'
import PendingScansPage from './PendingScansPage'

const TABS = [
  { id: 'stock',     label: 'Live Stock'  },
  { id: 'locations', label: 'Locations'   },
  { id: 'scans',     label: 'Ghost Scans' },
  { id: 'alerts',    label: 'Alerts'      },
  { id: 'expiry',    label: 'Expiry'      },
  { id: 'stocktake', label: 'Stocktake'   },
] as const

type TabId = typeof TABS[number]['id']

const GROUPS: { id: string; label: string; tabs: TabId[] }[] = [
  { id: 'stock',   label: 'Stock',   tabs: ['stock', 'locations', 'scans'] },
  { id: 'quality', label: 'Quality', tabs: ['alerts', 'expiry', 'stocktake'] },
]

export default function FloorWorkspace() {
  const [params, setParams] = useSearchParams()
  const raw = params.get('panel') ?? 'stock'
  const panel: TabId = TABS.some((t) => t.id === raw) ? raw as TabId : 'stock'

  const activeGroup = GROUPS.find((g) => g.tabs.includes(panel)) ?? GROUPS[0]

  // Realtime: invalidate products/eye caches on remote product_variant / stock_log changes
  useInventoryRealtime()

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Group selector */}
      <div className="flex items-center gap-1 px-3 py-2 border-b shrink-0 bg-background overflow-x-auto">
        {GROUPS.map((g) => (
          <button
            key={g.id}
            type="button"
            onClick={() => { setParams({ panel: g.tabs[0] }, { replace: true }) }}
            className={cn(
              'shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap',
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
      <div className="flex border-b shrink-0 bg-background overflow-x-auto">
        {activeGroup.tabs.map((tabId) => {
          const tab = TABS.find((t) => t.id === tabId)!
          return (
            <button
              key={tabId}
              type="button"
              onClick={() => { setParams({ panel: tabId }, { replace: true }) }}
              className={cn(
                'shrink-0 px-4 py-2 text-xs font-medium border-b-2 transition-colors -mb-px whitespace-nowrap',
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

      <PanelErrorBoundary name={`Floor · ${panel}`}>
        <div className="flex-1 overflow-hidden">
          {panel === 'stock'     && <InventoryPage />}
          {panel === 'locations' && <LocationInventoryPage />}
          {panel === 'alerts'    && <AlertsPage />}
          {panel === 'expiry'    && <ExpiryPage />}
          {panel === 'stocktake' && <StocktakePage />}
          {panel === 'scans'     && <PendingScansPage />}
        </div>
      </PanelErrorBoundary>
    </div>
  )
}
