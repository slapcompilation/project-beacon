// Layer: Floor — Live stock reality + alerts for managers
// Tabs: Live Stock | Alerts | Expiry
// Note: scan/barcode workflow stays in ScanLayout (/scan) for floor staff

import { useSearchParams } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useInventoryRealtime } from '@/features/inventory/hooks'
import InventoryPage from './InventoryPage'
import AlertsPage from './AlertsPage'
import ExpiryPage from './ExpiryPage'
import StocktakePage from './StocktakePage'

const TABS = [
  { id: 'stock',     label: 'Live Stock' },
  { id: 'alerts',    label: 'Alerts'     },
  { id: 'expiry',    label: 'Expiry'     },
  { id: 'stocktake', label: 'Stocktake'  },
] as const

type TabId = typeof TABS[number]['id']

export default function FloorWorkspace() {
  const [params, setParams] = useSearchParams()
  const raw = params.get('panel') ?? 'stock'
  const panel: TabId = TABS.some((t) => t.id === raw) ? raw as TabId : 'stock'

  // Realtime: invalidate products/eye caches on remote product_variant / stock_log changes
  useInventoryRealtime()

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
        {panel === 'stock'     && <InventoryPage />}
        {panel === 'alerts'    && <AlertsPage />}
        {panel === 'expiry'    && <ExpiryPage />}
        {panel === 'stocktake' && <StocktakePage />}
      </div>
    </div>
  )
}
