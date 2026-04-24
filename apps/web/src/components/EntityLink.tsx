// Layer: meta — clickable entity name
// Palantir pattern: clicking any entity name opens the ContextPanel detail tab.
// Use this instead of plain <Link> for entity references throughout the app.
//
// Usage:
//   <EntityLink type="variant" id={v.id}>{v.name}</EntityLink>
//   <EntityLink type="supplier" id={s.id} className="font-semibold">{s.name}</EntityLink>

import { cn } from '@/lib/utils'
import { useAppStore, type ObjectPanelEntity } from '@/stores/app.store'

interface EntityLinkProps {
  type: ObjectPanelEntity
  id: string
  children: React.ReactNode
  className?: string
}

export function EntityLink({ type, id, children, className }: EntityLinkProps) {
  const openEntityContext = useAppStore((s) => s.openEntityContext)

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        openEntityContext(type, id)
      }}
      className={cn(
        'text-left text-primary/90 hover:text-primary hover:underline underline-offset-2 cursor-pointer transition-colors',
        className,
      )}
    >
      {children}
    </button>
  )
}
