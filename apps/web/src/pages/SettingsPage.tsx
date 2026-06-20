// Palantir-style Settings: two-column layout with grouped left nav,
// progressive disclosure by role, URL-driven active section.
//
// Each section lives in features/settings/sections/. SettingsPage itself is
// nav + dispatch — the heavy lifting is in the section files.

import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Icon } from '@blueprintjs/core'
import type { IconName } from '@blueprintjs/icons'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth.store'
import { hasPermission } from '@beacon/types'
import { TeamSection } from '@/features/team/components/TeamSection'
import { ConstraintsSection } from '@/features/constraints/ConstraintsSection'
import { PrinciplesSection } from '@/features/principles/PrinciplesSection'
import { NotificationsSection }      from '@/features/settings/sections/NotificationsSection'
import { AlertThresholdsSection }    from '@/features/settings/sections/AlertThresholdsSection'
import { ApprovalThresholdsSection } from '@/features/settings/sections/ApprovalThresholdsSection'
import { AutonomousSection }         from '@/features/settings/sections/AutonomousSection'
import { CategoriesSection }         from '@/features/settings/sections/CategoriesSection'
import { LocationsSection }          from '@/features/settings/sections/LocationsSection'
import { CustomFieldsSection }       from '@/features/settings/sections/CustomFieldsSection'
import { MoveReasonsSection }        from '@/features/settings/sections/MoveReasonsSection'
import { HotelProfileSection }       from '@/features/settings/sections/HotelProfileSection'
import { WebhooksSection }           from '@/features/settings/sections/WebhooksSection'
import { DangerZoneSection }         from '@/features/settings/sections/DangerZoneSection'
import { AppearanceSection }         from '@/features/settings/sections/AppearanceSection'

// ─── Nav config ────────────────────────────────────────────────────────────────

type SectionId =
  | 'appearance'
  | 'notifications'
  | 'alert-thresholds'
  | 'approval-thresholds'
  | 'autonomous'
  | 'constraints'
  | 'principles'
  | 'categories'
  | 'locations'
  | 'custom-fields'
  | 'move-reasons'
  | 'hotel'
  | 'team'
  | 'webhooks'
  | 'danger'

interface NavItem {
  id: SectionId
  label: string
  icon: IconName
  layerDot: string
  /** Minimum role required to see this section. undefined = all roles. */
  requirePermission?: Parameters<typeof hasPermission>[1]
}

const NAV: NavItem[] = [
  { id: 'appearance',          label: 'Appearance',         icon: 'media',                   layerDot: 'bg-violet-500' },
  { id: 'notifications',       label: 'Notifications',      icon: 'notifications',           layerDot: 'bg-slate-400' },
  { id: 'alert-thresholds',    label: 'Alert Thresholds',   icon: 'dashboard',               layerDot: 'bg-orange-500' },
  { id: 'approval-thresholds', label: 'Approval Thresholds',icon: 'shield',                  layerDot: 'bg-amber-500',  requirePermission: 'can_manage_hotels' },
  { id: 'autonomous',          label: 'Autonomous Ops',     icon: 'predictive-analysis',     layerDot: 'bg-amber-500',  requirePermission: 'can_manage_hotels' },
  { id: 'constraints',         label: 'Constraints',        icon: 'shield',                  layerDot: 'bg-amber-500',  requirePermission: 'can_manage_hotels' },
  { id: 'principles',          label: 'Principles',         icon: 'learning',                layerDot: 'bg-amber-500',  requirePermission: 'can_manage_hotels' },
  { id: 'categories',        label: 'Categories',       icon: 'folder-open',                 layerDot: 'bg-blue-500',   requirePermission: 'can_manage_categories' },
  { id: 'locations',         label: 'Locations',        icon: 'map-marker',                  layerDot: 'bg-blue-500',   requirePermission: 'can_manage_categories' },
  { id: 'custom-fields',     label: 'Custom Fields',    icon: 'horizontal-bar-chart-desc',   layerDot: 'bg-blue-500',   requirePermission: 'can_manage_categories' },
  { id: 'move-reasons',      label: 'Move Reasons',     icon: 'clipboard',                   layerDot: 'bg-blue-500',   requirePermission: 'can_manage_categories' },
  { id: 'hotel',             label: 'Hotel Profile',    icon: 'office',                      layerDot: 'bg-purple-500', requirePermission: 'can_manage_hotels' },
  { id: 'team',              label: 'Team',             icon: 'people',                      layerDot: 'bg-purple-500', requirePermission: 'can_manage_users' },
  { id: 'webhooks',          label: 'Webhooks',         icon: 'notifications-updated',       layerDot: 'bg-purple-500', requirePermission: 'can_manage_hotels' },
  { id: 'danger',            label: 'GDPR',             icon: 'shield',                      layerDot: 'bg-red-500',    requirePermission: 'can_manage_users' },
]

const LAYER_GROUPS: { dot: string; label: string; ids: SectionId[] }[] = [
  { dot: 'bg-violet-500',  label: 'Personal',    ids: ['appearance'] },
  { dot: 'bg-slate-400',   label: 'Eye',         ids: ['notifications', 'alert-thresholds'] },
  { dot: 'bg-amber-500',   label: 'Flow',        ids: ['approval-thresholds', 'autonomous', 'constraints', 'principles'] },
  { dot: 'bg-blue-500',    label: 'Inventory',   ids: ['categories', 'locations', 'custom-fields', 'move-reasons'] },
  { dot: 'bg-purple-500',  label: 'Hotel',       ids: ['hotel', 'team', 'webhooks'] },
  { dot: 'bg-red-500',     label: 'Danger',      ids: ['danger'] },
]

function renderSection(id: SectionId) {
  switch (id) {
    case 'appearance':          return <AppearanceSection />
    case 'notifications':       return <NotificationsSection />
    case 'alert-thresholds':    return <AlertThresholdsSection />
    case 'approval-thresholds': return <ApprovalThresholdsSection />
    case 'autonomous':          return <AutonomousSection />
    case 'constraints':         return <ConstraintsSection />
    case 'principles':          return <PrinciplesSection />
    case 'categories':       return <CategoriesSection />
    case 'locations':        return <LocationsSection />
    case 'custom-fields':    return <CustomFieldsSection />
    case 'move-reasons':     return <MoveReasonsSection />
    case 'hotel':            return <HotelProfileSection />
    case 'team':             return <TeamSection />
    case 'webhooks':         return <WebhooksSection />
    case 'danger':           return <DangerZoneSection />
  }
}

// ─── Settings page ─────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const role = useAuthStore((s) => s.role)
  const [searchParams, setSearchParams] = useSearchParams()

  const visibleIds = useMemo((): Set<SectionId> => {
    const s = new Set<SectionId>()
    for (const item of NAV) {
      if (!item.requirePermission || (role && hasPermission(role, item.requirePermission))) {
        s.add(item.id)
      }
    }
    return s
  }, [role])

  const urlSection = searchParams.get('section') as SectionId | null
  const safeActive: SectionId = (urlSection && visibleIds.has(urlSection))
    ? urlSection
    : ([...visibleIds][0] ?? 'notifications')

  const setActiveSection = (id: SectionId) => { setSearchParams({ section: id }, { replace: true }) }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between border-b px-8 py-5 flex-shrink-0">
        <div>
          <h1 className="text-xl font-semibold">Settings</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Notifications, autonomous loop, hotel profile, team, webhooks &amp; data governance</p>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <nav className="w-52 flex-shrink-0 border-r overflow-y-auto py-4 px-2 space-y-4">
          {LAYER_GROUPS.map((group) => {
            const groupItems = group.ids
              .map((id) => NAV.find((n) => n.id === id))
              .filter((item): item is NavItem => !!item && visibleIds.has(item.id))
            if (groupItems.length === 0) return null

            return (
              <div key={group.label}>
                <div className="flex items-center gap-1.5 px-2 mb-1">
                  <span className={cn('h-1.5 w-1.5 rounded-full inline-block flex-shrink-0', group.dot)} />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    {group.label}
                  </span>
                </div>
                {groupItems.map((item) => {
                  const isActive = safeActive === item.id
                  return (
                    <button
                      key={item.id}
                      onClick={() => { setActiveSection(item.id) }}
                      className={cn(
                        'flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors',
                        isActive
                          ? 'bg-primary/10 text-primary font-medium'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      )}
                    >
                      <Icon icon={item.icon} size={14} className="flex-shrink-0" />
                      {item.label}
                    </button>
                  )
                })}
              </div>
            )
          })}
        </nav>

        <main className="flex-1 overflow-y-auto px-8 py-6 max-w-2xl">
          {renderSection(safeActive)}
        </main>
      </div>
    </div>
  )
}
