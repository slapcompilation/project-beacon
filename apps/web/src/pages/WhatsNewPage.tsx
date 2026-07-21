// What's New — the product changelog. Opening it marks the latest entry seen,
// which clears the sidebar dot.

import { useEffect } from 'react'
import { format } from 'date-fns'
import { Icon, Tag, Intent } from '@blueprintjs/core'
import type { IconName } from '@blueprintjs/icons'
import { useWhatsNew } from '@/features/whatsNew/hooks'
import type { ChangeCategory } from '@/features/whatsNew/changelog'

const CAT: Record<ChangeCategory, { label: string; intent: Intent; icon: IconName }> = {
  feature:     { label: 'New',      intent: Intent.SUCCESS, icon: 'star' },
  improvement: { label: 'Improved', intent: Intent.PRIMARY, icon: 'trending-up' },
  fix:         { label: 'Fixed',    intent: Intent.WARNING, icon: 'build' },
}

export default function WhatsNewPage() {
  const { entries, markSeen } = useWhatsNew()

  useEffect(() => { markSeen() }, [markSeen])

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-8 py-5 flex-shrink-0">
        <h1 className="text-xl font-semibold">What’s New</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Recent releases and improvements to Beacon.</p>
      </div>

      <div className="flex-1 overflow-auto">
        <ol className="mx-auto max-w-3xl px-8 py-6 space-y-6">
          {entries.map((e) => {
            const cat = CAT[e.category]
            return (
              <li key={`${e.date}-${e.title}`} className="relative border-l-2 border-border pl-6">
                <span className="absolute -left-[7px] top-1.5 h-3 w-3 rounded-full border-2 border-background bg-primary" />
                <div className="flex items-center gap-2 flex-wrap">
                  <Tag intent={cat.intent} minimal icon={cat.icon}>{cat.label}</Tag>
                  <h2 className="text-base font-semibold">{e.title}</h2>
                  <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                    {format(new Date(e.date), 'd MMM yyyy')}
                  </span>
                </div>
                <ul className="mt-2 space-y-1.5">
                  {e.highlights.map((h, i) => (
                    <li key={i} className="flex gap-2 text-sm text-muted-foreground">
                      <Icon icon="dot" size={14} className="mt-0.5 flex-shrink-0" />
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
              </li>
            )
          })}
        </ol>
      </div>
    </div>
  )
}
