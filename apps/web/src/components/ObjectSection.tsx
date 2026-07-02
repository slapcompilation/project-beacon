// Shared body section for object views — icon + title + optional subtitle over
// its content. Replaces the per-page Section helper the AIP-native pages each
// re-declared with a narrow icon union.

import type { ReactNode } from 'react'
import { Icon } from '@blueprintjs/core'
import type { IconName } from '@blueprintjs/icons'

export function ObjectSection({ title, icon, subtitle, children }: {
  title: string
  icon: IconName
  subtitle?: string
  children: ReactNode
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        <Icon icon={icon} size={14} className="text-muted-foreground" />
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      {subtitle && <p className="text-[11px] text-muted-foreground -mt-1.5 ml-6">{subtitle}</p>}
      {children}
    </section>
  )
}
