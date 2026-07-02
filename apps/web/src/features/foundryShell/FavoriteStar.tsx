// Star toggle — Foundry's favorite affordance. Drop it next to an object's
// title; toggling adds/removes it from the sidebar Files section. Highlighted
// (gold) when starred.

import { Button } from '@blueprintjs/core'
import { useFavoritesStore, type FavoriteItem } from '@/stores/favorites.store'

export function FavoriteStar({ item, className }: { item: FavoriteItem; className?: string }) {
  const isFavorite = useFavoritesStore((s) => s.isFavorite(item.id))
  const toggle = useFavoritesStore((s) => s.toggle)
  return (
    <Button
      variant="minimal"
      size="small"
      className={className}
      icon={isFavorite ? 'star' : 'star-empty'}
      intent={isFavorite ? 'warning' : 'none'}
      title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
      aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
      onClick={() => { toggle(item) }}
    />
  )
}
