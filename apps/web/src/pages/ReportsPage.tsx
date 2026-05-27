// Layer: Eye + Mind — Intelligence reports
// Palantir principle: a manager should open this page and immediately know
// the state of the world — not hunt through tabs to assemble the picture.
//
// Each report lives in features/reports/sections/. This file is nav +
// dispatch + the always-visible ExecutiveStrip.

import { lazy, Suspense } from 'react'
import { useSearchParams } from 'react-router-dom'
import { format, startOfMonth } from 'date-fns'
import { Icon, Intent, Spinner, SpinnerSize } from '@blueprintjs/core'
import type { IconName } from '@blueprintjs/icons'
import { cn } from '@/lib/utils'
import { useCurrency } from '@/hooks/useCurrency'
import { useProducts } from '@/features/inventory/hooks'
import { useStockMovementReport } from '@/features/inventory/hooks/reports'
import { ProcurementInsights } from '@/features/mind'
import { ForecastReport, AnomalyFeed } from '@/features/eye'

import { ExecutiveStrip }       from '@/features/reports/sections/ExecutiveStrip'
import { ValuationReport }      from '@/features/reports/sections/ValuationReport'
import { ConsumptionReport }    from '@/features/reports/sections/ConsumptionReport'
import { WasteReport }          from '@/features/reports/sections/WasteReport'
import { StockMovementReport }  from '@/features/reports/sections/StockMovementReport'
import { LowStockReport }       from '@/features/reports/sections/LowStockReport'
import { OverstockReport }      from '@/features/reports/sections/OverstockReport'
import { LocationReport }       from '@/features/reports/sections/LocationReport'
import { ExpiryReport }         from '@/features/reports/sections/ExpiryReport'
import { CostVarianceReport }   from '@/features/reports/sections/CostVarianceReport'

// Finance tab loaded lazily — same component as standalone FinancePage
const FinanceTab = lazy(() => import('@/pages/FinancePage'))

// ─── Report nav config ────────────────────────────────────────────────────────

interface ReportItem {
  id: string
  label: string
  icon: IconName
}

interface ReportGroup {
  label: string
  icon: IconName
  dotColor: string
  items: ReportItem[]
}

const REPORT_GROUPS: ReportGroup[] = [
  {
    label: 'Stock',
    icon: 'box',
    dotColor: 'bg-blue-500',
    items: [
      { id: 'valuation',  label: 'Valuation',   icon: 'chart'         },
      { id: 'lowstock',   label: 'Low Stock',    icon: 'warning-sign' },
      { id: 'overstock',  label: 'Overstock',    icon: 'trending-up'  },
    ],
  },
  {
    label: 'Activity',
    icon: 'pulse',
    dotColor: 'bg-purple-500',
    items: [
      { id: 'consumption', label: 'Consumption',    icon: 'trending-down'  },
      { id: 'movement',    label: 'Movement Log',   icon: 'swap-horizontal' },
      { id: 'waste',       label: 'Waste & Loss',   icon: 'flame'          },
    ],
  },
  {
    label: 'Risk',
    icon: 'warning-sign',
    dotColor: 'bg-yellow-500',
    items: [
      { id: 'expiry',      label: 'Expiry',       icon: 'calendar' },
      { id: 'by-location', label: 'By Location',  icon: 'map-marker' },
    ],
  },
  {
    label: 'Intelligence',
    icon: 'eye-open',
    dotColor: 'bg-orange-500',
    items: [
      { id: 'forecast',   label: 'Forecast',          icon: 'trending-down' },
      { id: 'anomalies',  label: 'Anomalies',          icon: 'flash'        },
    ],
  },
  {
    label: 'Finance',
    icon: 'lightbulb',
    dotColor: 'bg-purple-600',
    items: [
      { id: 'procurement',   label: 'Procurement',    icon: 'truck'   },
      { id: 'cost-variance', label: 'Cost Variance',  icon: 'manual'  },
      { id: 'finance',       label: 'Finance',         icon: 'dollar' },
    ],
  },
]

const REPORT_META: Record<string, { title: string; desc: string }> = {
  'valuation':    { title: 'Inventory Valuation',        desc: 'Current stock value by product, sorted by total value. Export for balance sheet.' },
  'lowstock':     { title: 'Low Stock',                  desc: 'Variants below par level ranked by urgency. Critical items at the top.' },
  'overstock':    { title: 'Overstock',                  desc: 'Capital tied up above 2× par level — potential cash to release.' },
  'consumption':  { title: 'Consumption',                desc: 'Where is money going and at what rate? Sorted by cost impact for the selected period.' },
  'movement':     { title: 'Movement Log',               desc: 'Complete immutable audit trail of every stock change. Every in, out, and correction.' },
  'waste':        { title: 'Waste & Loss',               desc: 'Removals categorised as waste — spoilage, breakage, theft. Cost impact vs prior period.' },
  'expiry':       { title: 'Expiry Risk',                desc: 'Variants expiring within 12 months, sorted by value at risk.' },
  'by-location':  { title: 'Stock by Location',          desc: 'Variants below par level grouped by storage location.' },
  'forecast':     { title: 'Depletion Forecast',         desc: 'Days until stockout per variant based on 30-day rolling consumption. One-click restock.' },
  'anomalies':    { title: 'Anomaly Detection',          desc: 'Dead stock and consumption spikes flagged by the intelligence engine.' },
  'procurement':  { title: 'Procurement Intelligence',   desc: 'Supplier spend, fulfillment rates, and lead times from restock history.' },
  'cost-variance':{ title: 'Cost Variance',              desc: 'Every delivery where invoice price deviated from expected. Overcharges surface first.' },
  'finance':      { title: 'Finance Overview',           desc: 'Revenue attribution, margin analysis, and P&L contribution.' },
}

export default function ReportsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = searchParams.get('tab') ?? 'valuation'

  const currency = useCurrency()

  const { data: products = [], isLoading: productsLoading } = useProducts()

  // MTD + prior month for the ExecutiveStrip.
  const today     = format(new Date(), 'yyyy-MM-dd')
  const mtdFrom   = format(startOfMonth(new Date()), 'yyyy-MM-dd')
  const priorFrom = format(startOfMonth(new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1)), 'yyyy-MM-dd')
  const priorTo   = format(new Date(new Date().getFullYear(), new Date().getMonth(), 0), 'yyyy-MM-dd')

  const { data: mtdMovements   = [] } = useStockMovementReport(mtdFrom,   today)
  const { data: priorMovements = [] } = useStockMovementReport(priorFrom, priorTo)

  const meta = REPORT_META[activeTab] ?? { title: activeTab, desc: '' }

  const setTab = (id: string) => { setSearchParams({ tab: id }) }

  return (
    <div className="flex flex-col h-full">

      <div className="flex-shrink-0 border-b px-8 pt-5 pb-0">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-xl font-semibold">Reports</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Operations intelligence — consumption, waste, valuation, and forecast
            </p>
          </div>
        </div>

        {!productsLoading && (
          <ExecutiveStrip
            products={products}
            mtdMovements={mtdMovements}
            priorMovements={priorMovements}
            currency={currency}
          />
        )}
      </div>

      <div className="flex flex-1 overflow-hidden">

        <nav className="w-44 flex-shrink-0 border-r overflow-y-auto px-3 py-4 space-y-5">
          {REPORT_GROUPS.map((group) => (
            <div key={group.label}>
              <div className="mb-1 flex items-center gap-1.5 px-2">
                <span className={cn('h-1.5 w-1.5 rounded-full flex-shrink-0', group.dotColor)} />
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  {group.label}
                </p>
              </div>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive = activeTab === item.id
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => { setTab(item.id) }}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                      )}
                    >
                      <Icon icon={item.icon} size={12} className="flex-shrink-0" />
                      <span className="truncate text-xs">{item.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="flex-1 overflow-y-auto">
          <div className="px-8 py-6">
            <div className="mb-6 pb-4 border-b">
              <h2 className="text-base font-semibold">{meta.title}</h2>
              {meta.desc && (
                <p className="mt-0.5 text-sm text-muted-foreground">{meta.desc}</p>
              )}
            </div>

            {activeTab === 'valuation'    && <ValuationReport products={products} currency={currency} />}
            {activeTab === 'lowstock'     && <LowStockReport products={products} currency={currency} />}
            {activeTab === 'overstock'    && <OverstockReport products={products} currency={currency} />}
            {activeTab === 'consumption'  && <ConsumptionReport products={products} currency={currency} />}
            {activeTab === 'movement'     && <StockMovementReport />}
            {activeTab === 'waste'        && <WasteReport products={products} currency={currency} />}
            {activeTab === 'expiry'       && <ExpiryReport />}
            {activeTab === 'by-location'  && <LocationReport />}
            {activeTab === 'forecast'     && <ForecastReport />}
            {activeTab === 'anomalies'    && <AnomalyFeed />}
            {activeTab === 'procurement'  && <ProcurementInsights />}
            {activeTab === 'cost-variance'&& <CostVarianceReport currency={currency} />}
            {activeTab === 'finance'      && (
              <Suspense fallback={
                <div className="flex h-40 items-center justify-center">
                  <Spinner size={SpinnerSize.STANDARD} intent={Intent.PRIMARY} />
                </div>
              }>
                <FinanceTab />
              </Suspense>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
