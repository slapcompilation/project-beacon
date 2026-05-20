import { useState } from 'react'
import { Icon } from '@blueprintjs/core'
import { cn } from '@/lib/utils'
import { useSituationScore } from '@/features/briefing/hooks'
import { SITUATION_CFG, DOMAIN_ICON } from './constants'

export function SituationBanner() {
  const { data } = useSituationScore()
  const [open, setOpen] = useState(true)

  if (!data || data.level === 'nominal') return null

  const cfg = SITUATION_CFG[data.level]

  return (
    <div className={cn('rounded-lg border overflow-hidden', cfg.border, cfg.bg)}>
      <button
        type="button"
        onClick={() => { setOpen((v) => !v) }}
        className={cn('w-full flex items-center gap-3 px-4 py-3 transition-colors text-left', cfg.headerBg)}
      >
        <Icon icon="shield" size={14} className={cn('shrink-0', cfg.iconCls)} />
        <span className={cn('text-xs uppercase tracking-widest flex-1', cfg.levelCls)}>
          Situation: {data.level}
        </span>
        <div className="hidden sm:flex items-center gap-2 shrink-0">
          <div className="w-20 h-1.5 rounded-full bg-black/10 overflow-hidden">
            <div
              className={cn('h-full rounded-full', data.level === 'critical' ? 'bg-red-500' : 'bg-amber-500')}
              style={{ width: `${String(data.score)}%` }}
            />
          </div>
          <span className="text-[10px] tabular-nums text-muted-foreground">{data.score}/100</span>
        </div>
        <span className="text-xs text-muted-foreground shrink-0">
          {data.incidents.length} signal{data.incidents.length !== 1 ? 's' : ''}
        </span>
        <Icon icon={open ? 'chevron-down' : 'chevron-right'} size={14} className="text-muted-foreground shrink-0" />
      </button>

      {open && data.incidents.length > 0 && (
        <div className="divide-y divide-black/5 dark:divide-white/5">
          {data.incidents.map((inc, i) => {
            const iconName = DOMAIN_ICON[inc.domain]
            const isCrit = inc.severity === 'critical'
            return (
              <div key={i} className="flex items-start gap-3 px-4 py-3">
                <div className={cn(
                  'h-6 w-6 rounded flex items-center justify-center shrink-0 mt-0.5',
                  isCrit ? 'bg-red-100 dark:bg-red-950/40' : 'bg-amber-100 dark:bg-amber-950/40',
                )}>
                  <Icon icon={iconName} size={14} className={isCrit ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn('text-xs font-semibold leading-snug', isCrit ? 'text-red-700 dark:text-red-400' : 'text-amber-700 dark:text-amber-400')}>
                    {inc.label}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">{inc.context}</p>
                </div>
              </div>
            )
          })}
          <p className="px-4 py-2 text-[10px] text-muted-foreground/60">
            Cross-domain synthesis · based on live stock, waste, PO, and occupancy data
          </p>
        </div>
      )}
    </div>
  )
}
