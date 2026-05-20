// Shared date-range picker for Reports, Finance, Audit. Exports the hook + the bar.

import { useState, useMemo } from 'react'
import { format, subDays, startOfMonth } from 'date-fns'
import { InputGroup, SegmentedControl } from '@blueprintjs/core'

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
  presets?: DatePreset[]
}

export function useDateRange(options: DateRangeOptions = {}) {
  const { defaultPreset = '30d', presets = ['7d', '30d', 'month', 'custom'] } = options
  const today = format(new Date(), 'yyyy-MM-dd')
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
      <SegmentedControl
        options={presets.map((p) => ({ value: p, label: PRESET_LABELS[p] }))}
        value={preset}
        onValueChange={(v) => { setPreset(v as DatePreset) }}
        size="small"
      />
      {preset === 'custom' && (
        <>
          <div className="w-36">
            <InputGroup
              type="date"
              value={customFrom}
              onChange={(e) => { setCustomFrom(e.target.value) }}
              size="small"
            />
          </div>
          <span className="text-muted-foreground text-sm">→</span>
          <div className="w-36">
            <InputGroup
              type="date"
              value={customTo}
              onChange={(e) => { setCustomTo(e.target.value) }}
              size="small"
            />
          </div>
        </>
      )}
      {preset !== 'custom' && (
        <span className="text-xs text-muted-foreground">{dateFrom} → {dateTo}</span>
      )}
    </div>
  )
}
