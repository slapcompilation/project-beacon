// Canonical object-view header (AIP parity, Phase 2). Uniform anatomy across
// every node type: icon + title + favorite star, a chrome/meta chip row (type ·
// key ids · scope — the equivalent of Foundry's File/version/catalog row), and
// a right-aligned action bar. Object pages render their metric strip + body +
// right-rail audit beneath this.

import type { ReactNode } from 'react'
import { Icon } from '@blueprintjs/core'
import type { IconName } from '@blueprintjs/icons'
import { cn } from '@/lib/utils'
import { FavoriteStar } from '@/features/foundryShell/FavoriteStar'
import type { FavoriteItem } from '@/stores/favorites.store'

export interface ObjectMetaChip {
  icon?: IconName
  label: string
  mono?: boolean
  /** When set, the chip renders as a link (mailto:/tel:/route). */
  href?: string
}

export function ObjectViewHeader({
  icon, title, star, meta, actions,
}: {
  icon: IconName
  title: string
  /** When set, renders a favorite star next to the title. */
  star?: FavoriteItem
  /** The chrome/meta row — object type, key ids, scope. */
  meta?: ReadonlyArray<ObjectMetaChip>
  /** Right-aligned action bar (typed Actions). */
  actions?: ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <Icon icon={icon} size={20} className="text-muted-foreground shrink-0" />
          <h1 className="text-xl font-semibold truncate">{title}</h1>
          {star && <FavoriteStar item={star} />}
        </div>
        {meta && meta.length > 0 && (
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {meta.map((m) => {
              const className = cn(
                'inline-flex items-center gap-1 rounded border border-border/60 bg-surface-2/50 px-1.5 py-0.5 text-[11px] text-muted-foreground',
                m.mono && 'font-mono',
                m.href && 'hover:text-foreground hover:border-border transition-colors',
              )
              const inner = <>{m.icon && <Icon icon={m.icon} size={11} />}{m.label}</>
              return m.href
                ? <a key={m.label} href={m.href} className={className}>{inner}</a>
                : <span key={m.label} className={className}>{inner}</span>
            })}
          </div>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  )
}
