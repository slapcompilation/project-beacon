// Canonical sticky header band for AIP-native object views (Case, Proposal,
// Constraint, Principle, Document, Action Chain). One idiom: breadcrumb → violet
// type icon → title → favorite star → status tags → mono id. Sits above the
// metric strip + action bar bands (CLAUDE.md anatomy: header → metric strip →
// action bar → body → right-rail audit).

import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '@blueprintjs/core'
import type { IconName } from '@blueprintjs/icons'
import { FavoriteStar } from '@/features/foundryShell/FavoriteStar'
import type { FavoriteItem } from '@/stores/favorites.store'

export function ObjectHeaderBand({
  breadcrumb, icon, title, star, tags, id,
}: {
  breadcrumb: { label: string; to: string }
  icon: IconName
  title: string
  /** When set, renders a favorite star after the title. */
  star?: FavoriteItem
  /** Status/category tags rendered after the star. */
  tags?: ReactNode
  /** Mono id line under the title row. */
  id?: string
}) {
  return (
    <header className="px-6 py-4 border-b shrink-0">
      <div className="flex items-center gap-2 flex-wrap mb-1">
        <Link to={breadcrumb.to} className="text-xs text-muted-foreground hover:text-foreground">{breadcrumb.label}</Link>
        <Icon icon="chevron-right" size={10} className="text-muted-foreground" />
        <Icon icon={icon} size={14} className="text-violet-500" />
        <h1 className="text-sm font-semibold truncate">{title}</h1>
        {star && <FavoriteStar item={star} />}
        {tags}
      </div>
      {id && <p className="text-[11px] text-muted-foreground font-mono">{id}</p>}
    </header>
  )
}
