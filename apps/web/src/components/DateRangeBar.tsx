// Layer: Eye / Mind — shared date-range picker used across Reports, Finance, Audit.
// Exposes useDateRange() hook + DateRangeBar UI in one import.

import { useState, useMemo } from 'react'
import { format, subDays, startOfMonth } from 'date-fns'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export type DatePreset = '7d' | '30d' | '90d' | 'month' | 'custom'

const PRESET_LABELS: Record<DatePreset, string> = {
  '7d':     '7 days',
  '30d':    '30 days',
  '90d':    '90 days',
  'month':  'This month',
  'custom': 'Custom',
}

interface DateRangeOptions {
  defaultPreset?: DatePreset
  /** Subset of presets to show; defaults to ['7d','30d','month','custom'] */
  presets?: DatePreset[]
}

export function useDateRange(options: DateRangeOptions = {}) {
  const { defaultPreset = '30d', presets = ['7d', '30d', 'month', 'custom'] } = options
  const today      = format(new Date(), 'yyyy-MM-dd')
  const [preset, setPreset]         = useState<DatePreset>(defaultPreset)
  const [customFrom, setCustomFrom] = useState(format(subDays(new Date(), 29), 'yyyy-MM-dd'))
  const [customTo,   setCustomTo]   = useState(today)

  const { dateFrom, dateTo } = useMemo(() => {
    if (preset === '7d')    return { dateFrom: format(subDays(new Date(), 6),   'yyyy-MM-dd'), dateTo: today }
    if (preset === '30d')   return { dateFrom: format(subDays(new Date(), 29),  'yyyy-MM-dd'), dateTo: today }
    if (preset === '90d')   return { dateFrom: format(subDays(new Date(), 89),  'yyyy-MM-dd'), dateTo: today }
    if (preset === 'month') return { dateFrom: format(startOfMonth(new Date()), 'yyyy-MM-dd'), dateTo: today }
    return { dateFrom: customFrom, dateTo: customTo }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset, customFrom, customTo])

  return { preset, setPreset, presets, dateFrom, dateTo, customFrom, setCustomFrom, customTo, setCustomTo }
}

export function DateRangeBar(props: ReturnType<typeof useDateRange>) {
  const { preset, setPreset, presets, dateFrom, dateTo, customFrom, setCustomFrom, customTo, setCustomTo } = props
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex rounded-lg border overflow-hidden text-xs">
        {presets.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => { setPreset(p) }}
            className={cn(
              'px-3 py-1.5 font-medium transition-colors',
              preset === p
                ? 'bg-primary text-primary-foreground'
                : 'bg-background text-muted-foreground hover:bg-muted',
            )}
          >
            {PRESET_LABELS[p]}
          </button>
        ))}
      </div>
      {preset === 'custom' && (
        <>
          <Input
            type="date"
            value={customFrom}
            onChange={(e) => { setCustomFrom(e.target.value) }}
            className="w-36 h-8 text-sm"
          />
          <span className="text-muted-foreground text-sm">→</span>
          <Input
            type="date"
            value={customTo}
            onChange={(e) => { setCustomTo(e.target.value) }}
            className="w-36 h-8 text-sm"
          />
        </>
      )}
      {preset !== 'custom' && (
        <span className="text-xs text-muted-foreground">{dateFrom} → {dateTo}</span>
      )}
    </div>
  )
}
