// Scope switcher: pick one property or the whole portfolio.
// Hidden if single hotel + no org. "All properties" → scope='organization'.

import { Icon, Menu, MenuDivider, MenuItem, Popover } from '@blueprintjs/core'
import { useAppStore } from '@/stores/app.store'
import { useActiveHotelId } from '@/hooks/useActiveHotelId'
import { useActiveOrgId, useScopeMode } from '@/hooks/useActiveOrgId'
import { useHotels } from '@/features/hotel/hooks'
import { useOrganizations, useHasOrgScope } from '@/features/organizations/hooks'

export function ScopeSwitcher({ variant }: { variant?: 'sidebar' } = {}) {
  const onDark = variant === 'sidebar'
  const scopeMode      = useScopeMode()
  const activeHotelId  = useActiveHotelId()
  const activeOrgId    = useActiveOrgId()
  const { data: hotels = [] } = useHotels()
  const { data: orgs   = [] } = useOrganizations()
  const hasOrgScope    = useHasOrgScope()

  const enterOrgScope   = useAppStore((s) => s.enterOrgScope)
  const enterHotelScope = useAppStore((s) => s.enterHotelScope)

  const activeHotel = hotels.find((h) => h.id === activeHotelId)
  const activeOrg   = orgs.find((o) => o.id === activeOrgId)

  if (!hasOrgScope && hotels.length <= 1) {
    return activeHotel ? (
      <span className={onDark
        ? 'block truncate px-2 text-[11px] text-[#6b7482]'
        : 'text-[10px] text-muted-foreground/50 truncate max-w-[120px]'}>
        {activeHotel.name}
      </span>
    ) : null
  }

  const triggerLabel =
    scopeMode === 'organization'
      ? (activeOrg?.name ?? 'Portfolio')
      : (activeHotel?.name ?? '…')

  const triggerIcon = scopeMode === 'organization' ? 'graph' : 'office'

  return (
    <Popover
      placement="bottom-start"
      content={
        <Menu className="!min-w-56">
          {hasOrgScope && activeOrg && (
            <>
              <MenuDivider title="Portfolio" />
              <MenuItem
                icon="graph"
                text={
                  <span className="flex items-center gap-2 w-full">
                    <span className="flex-1">All properties</span>
                    <span className="text-[10px] text-muted-foreground tabular-nums">{hotels.length}</span>
                  </span>
                }
                labelElement={scopeMode === 'organization' ? <Icon icon="tick" size={12} /> : undefined}
                onClick={() => { enterOrgScope(activeOrg.id) }}
              />
              <MenuDivider />
            </>
          )}

          <MenuDivider title="Property" />
          {hotels.map((h) => (
            <MenuItem
              key={h.id}
              icon="office"
              text={h.name}
              labelElement={scopeMode === 'hotel' && h.id === activeHotelId ? <Icon icon="tick" size={12} /> : undefined}
              onClick={() => { enterHotelScope(h.id) }}
            />
          ))}
        </Menu>
      }
    >
      <button className={onDark
        ? 'flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-xs text-[#cfd4dd] transition-colors hover:bg-white/5 hover:text-white'
        : 'flex items-center gap-1 rounded px-1.5 py-1 text-xs text-muted-foreground hover:bg-surface-2 hover:text-foreground transition-colors max-w-[180px]'}>
        <Icon icon={triggerIcon} size={12} className="shrink-0" />
        <span className="flex-1 truncate text-left">{triggerLabel}</span>
        <Icon icon="chevron-down" size={10} className="shrink-0" />
      </button>
    </Popover>
  )
}
