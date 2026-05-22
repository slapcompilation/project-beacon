import { useState } from 'react'
import { Icon, Intent, Spinner, SpinnerSize } from '@blueprintjs/core'
import { useStockPressure } from '@/features/eye/hooks'
import { PressureRow } from './PressureRow'

export function PressureSection() {
  const { data: items = [], isLoading } = useStockPressure()
  const [open, setOpen] = useState(true)

  const critical = items.filter((i) => i.urgency_tier === 'critical')
  const warning  = items.filter((i) => i.urgency_tier === 'warning')
  const watch    = items.filter((i) => i.urgency_tier === 'watch')

  if (!isLoading && items.length === 0) return null

  return (
    <div className="rounded-lg border overflow-hidden">
      <button
        type="button"
        onClick={() => { setOpen((v) => !v) }}
        className="w-full flex items-center gap-2.5 px-4 py-2.5 bg-muted/20 hover:bg-muted/40 transition-colors text-left"
      >
        <Icon icon="flash" size={14} className="text-yellow-500 shrink-0" />
        <span className="text-xs font-semibold uppercase tracking-wider text-yellow-700 dark:text-yellow-400 flex-1">
          Stock Pressure
        </span>
        {isLoading
          ? <Spinner size={SpinnerSize.SMALL} intent={Intent.PRIMARY} />
          : (
            <span className="text-xs font-bold tabular-nums text-muted-foreground">
              {critical.length > 0 && <span className="text-red-500">{critical.length} critical · </span>}
              {warning.length > 0 && <span className="text-amber-500">{warning.length} warning · </span>}
              {watch.length} watch
            </span>
          )}
        <Icon icon={open ? 'chevron-down' : 'chevron-right'} size={14} className="text-muted-foreground" />
      </button>

      {open && (
        <div>
          {[...critical, ...warning, ...watch].map((item) => (
            <PressureRow key={item.variant_id} item={item} />
          ))}
          <div className="px-4 py-2 bg-muted/10 border-t">
            <p className="text-[10px] text-muted-foreground">
              Based on 30-day avg consumption · items running out within 14 days · sorted by urgency
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
