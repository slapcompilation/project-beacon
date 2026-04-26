// Layer: meta — Scope switcher (Phase R1, Network tier)
//
// Renders the operator's current scope (one property or portfolio) and lets
// them switch. Visibility rules:
//   - User has NO org membership AND <2 hotels:  hidden (just shows hotel name)
//   - User has NO org membership AND ≥2 hotels:  classic hotel switcher
//   - User HAS org membership:                   property + "All properties" entry
//
// Selecting "All properties" enters scope='organization' — useActiveHotelId()
// returns null and queries naturally span every hotel in the org.

import { Building2, Network, ChevronDown, Check } from 'lucide-react'
import { useAppStore } from '@/stores/app.store'
import { useActiveHotelId } from '@/hooks/useActiveHotelId'
import { useActiveOrgId, useScopeMode } from '@/hooks/useActiveOrgId'
import { useHotels } from '@/features/hotel/hooks'
import { useOrganizations, useHasOrgScope } from '@/features/organizations/hooks'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export function ScopeSwitcher() {
  const scopeMode      = useScopeMode()
  const activeHotelId  = useActiveHotelId()      // null in org scope
  const activeOrgId    = useActiveOrgId()
  const { data: hotels = [] } = useHotels()
  const { data: orgs   = [] } = useOrganizations()
  const hasOrgScope    = useHasOrgScope()

  const enterOrgScope   = useAppStore((s) => s.enterOrgScope)
  const enterHotelScope = useAppStore((s) => s.enterHotelScope)

  const activeHotel = hotels.find((h) => h.id === activeHotelId)
  const activeOrg   = orgs.find((o) => o.id === activeOrgId)

  // Nothing to switch — single hotel, no org scope. Show static label.
  if (!hasOrgScope && hotels.length <= 1) {
    return activeHotel ? (
      <span className="text-[10px] text-muted-foreground/50 truncate max-w-[120px]">
        {activeHotel.name}
      </span>
    ) : null
  }

  const triggerLabel =
    scopeMode === 'organization'
      ? (activeOrg?.name ?? 'Portfolio')
      : (activeHotel?.name ?? '…')

  const TriggerIcon = scopeMode === 'organization' ? Network : Building2

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-1 rounded px-1.5 py-1 text-xs text-muted-foreground hover:bg-surface-2 hover:text-foreground transition-colors max-w-[180px]">
        <TriggerIcon className="h-3 w-3 shrink-0" />
        <span className="truncate">{triggerLabel}</span>
        <ChevronDown className="h-2.5 w-2.5 shrink-0" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-56">
        {/* Portfolio entry — only for org-scoped users */}
        {hasOrgScope && activeOrg && (
          <>
            <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
              Portfolio
            </DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() => { enterOrgScope(activeOrg.id) }}
              className="flex items-center gap-2"
            >
              <Network className="h-3.5 w-3.5 text-violet-500" />
              <span className="flex-1">All properties</span>
              <span className="text-[10px] text-muted-foreground tabular-nums">
                {hotels.length}
              </span>
              {scopeMode === 'organization' && <Check className="h-3 w-3" />}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}

        {/* Per-property entries */}
        <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
          Property
        </DropdownMenuLabel>
        {hotels.map((h) => (
          <DropdownMenuItem
            key={h.id}
            onClick={() => { enterHotelScope(h.id) }}
            className="flex items-center gap-2"
          >
            <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="flex-1 truncate">{h.name}</span>
            {scopeMode === 'hotel' && h.id === activeHotelId && (
              <Check className="h-3 w-3" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
