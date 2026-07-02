// Foundry's "Manage your favorites" — review + remove starred objects that
// appear in the sidebar Files section.

import { Dialog, DialogBody, DialogFooter, Button, Icon, NonIdealState } from '@blueprintjs/core'
import { useNavigate } from 'react-router-dom'
import { useFavoritesStore } from '@/stores/favorites.store'

export function ManageFavoritesDialog({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const navigate  = useNavigate()
  const favorites = useFavoritesStore((s) => s.favorites)
  const remove    = useFavoritesStore((s) => s.remove)

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title="Manage your favorites" icon="star" style={{ width: 480 }}>
      <DialogBody>
        {favorites.length === 0 ? (
          <NonIdealState
            icon="star-empty"
            title="No favorites yet"
            description="Star an object from its page and it appears here and in the sidebar."
          />
        ) : (
          <div className="divide-y divide-border/60">
            {favorites.map((f) => (
              <div key={f.id} className="flex items-center gap-3 py-2">
                <Icon icon={f.icon} size={16} className="text-muted-foreground shrink-0" />
                <button
                  type="button"
                  onClick={() => { onClose(); void navigate(f.path) }}
                  className="min-w-0 flex-1 text-left"
                >
                  <span className="block truncate text-sm font-medium text-foreground">{f.label}</span>
                  {f.subtitle && <span className="block truncate text-xs text-muted-foreground">{f.subtitle}</span>}
                </button>
                <Button
                  variant="minimal"
                  size="small"
                  icon="star"
                  intent="warning"
                  title="Remove from favorites"
                  aria-label="Remove from favorites"
                  onClick={() => { remove(f.id) }}
                />
              </div>
            ))}
          </div>
        )}
      </DialogBody>
      <DialogFooter actions={<Button intent="primary" text="Done" onClick={onClose} />} />
    </Dialog>
  )
}
