// GlobalNav — wires the presentational FoundrySidebar into the app: maps each
// rail id to a route or a panel action, and derives the active item from the
// current URL. This is the Foundry-style left sidebar as the real global nav,
// replacing the bottom CommandDock (docs/AIP-UX-RESTRUCTURE.md, Phase 1).

import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import { toast } from 'sonner'
import { Popover, Menu, MenuItem, MenuDivider, Icon } from '@blueprintjs/core'
import { FoundrySidebar } from './FoundrySidebar'
import { ManageFavoritesDialog } from './ManageFavoritesDialog'
import { ScopeSwitcher } from '@/components/layout/ScopeSwitcher'
import { PurposeSwitcher } from '@/features/purpose/PurposeSwitcher'
import { services } from '@/lib/services'
import { useAppStore } from '@/stores/app.store'
import { useAuthStore } from '@/stores/auth.store'
import { useRecentActivity } from '@/features/inventory/hooks/reports'
import { useFavoritesStore } from '@/stores/favorites.store'
import { useAlertCount } from '@/hooks/useAlertCount'
import { useUnreadNotificationCount } from '@/features/notifications/hooks'
import { useWhatsNew } from '@/features/whatsNew/hooks'
import { useAipSignalCounts } from '@/features/aipSignals/hooks'
import { cn } from '@/lib/utils'

// /mind hosts both Decisions (queue/approvals/cases) and Studio (builders); the
// ?aip= tab decides which rail item is active.
const STUDIO_AIP_TABS = new Set([
  'studio',
  'agents', 'system-map', 'ontology', 'tools', 'objectives', 'forecast-lab',
  'calibration', 'flywheel', 'monitors', 'automations', 'documents', 'entity-links', 'answers',
  'principles', 'constraints', 'scenarios', 'action-chains', 'copilot', 'policy',
])

function activeIdFor(pathname: string, search: string): string {
  if (pathname.startsWith('/briefing')) return 'home'
  if (pathname.startsWith('/applications')) return 'apps'
  if (pathname.startsWith('/objects')) return 'objects'
  if (pathname.startsWith('/whats-new')) return 'whatsnew'
  if (pathname.startsWith('/eye')) return 'insights'
  if (pathname.startsWith('/account')) return 'account'
  if (pathname.startsWith('/mind')) {
    const aip = new URLSearchParams(search).get('aip')
    return aip && STUDIO_AIP_TABS.has(aip) ? 'studio' : 'decisions'
  }
  return ''
}

export function GlobalNav() {
  const navigate = useNavigate()
  const { pathname, search } = useLocation()
  const toggleCommandBar   = useAppStore((s) => s.toggleCommandBar)
  const setNotifPanelOpen  = useAppStore((s) => s.setNotifPanelOpen)
  const toggleCopilot      = useAppStore((s) => s.toggleCopilot)
  const favorites          = useFavoritesStore((s) => s.favorites)
  const filesItems = favorites.map((f) => ({ id: f.id, label: f.label, icon: f.icon, subtitle: f.subtitle }))
  const email              = useAuthStore((s) => s.session?.user.email ?? '')
  const notifTotal         = useAlertCount() + useUnreadNotificationCount()
  const { hasUnseen }      = useWhatsNew()
  const { data: aip }      = useAipSignalCounts()
  const [manageOpen, setManageOpen] = useState(false)

  const onSelect = (id: string) => {
    const fav = favorites.find((f) => f.id === id)
    if (fav) { void navigate(fav.path); return }
    switch (id) {
      case 'home':      void navigate('/briefing'); break
      case 'search':    toggleCommandBar(); break
      case 'notifs':    setNotifPanelOpen(true); break
      case 'whatsnew':  void navigate('/whats-new'); break
      case 'recent':    toggleCommandBar(); break
      case 'objects':   void navigate('/objects'); break
      case 'apps':      void navigate('/applications'); break
      case 'decisions': void navigate('/mind?aip=queue'); break
      case 'insights':  void navigate('/eye'); break
      case 'studio':    void navigate('/mind?aip=studio'); break
      case 'copilot':   toggleCopilot(); break
      case 'support':   void navigate('/settings'); break
      case 'account':   void navigate('/account'); break
    }
  }

  return (
    <>
      <FoundrySidebar
        activeId={activeIdFor(pathname, search)}
        onSelect={onSelect}
        headerSlot={
          <div className="space-y-1.5">
            <ScopeSwitcher variant="sidebar" />
            <PurposeSwitcher variant="sidebar" />
            <QuickCreate />
          </div>
        }
        popovers={{ recent: <RecentPanel /> }}
        filesItems={filesItems}
        badges={{
          notifs:    notifTotal,
          decisions: (aip?.queue ?? 0) + (aip?.approvals ?? 0),
          studio:    aip?.entityLinks ?? 0,
        }}
        dots={{ whatsnew: hasUnseen }}
        accountInitials={initialsFromEmail(email)}
        accountMenu={<AccountMenu />}
        onViewAll={(header) => { if (header === 'Files') setManageOpen(true); else void navigate('/applications') }}
      />
      <ManageFavoritesDialog isOpen={manageOpen} onClose={() => { setManageOpen(false) }} />
    </>
  )
}

// Foundry's Recent panel — the last stock movements, each linking to its
// variant. Opens as a white panel to the right of the "Recent" rail item.
function RecentPanel() {
  const navigate = useNavigate()
  const { data = [], isLoading } = useRecentActivity(12)
  return (
    <div className="w-72 max-h-[26rem] overflow-y-auto py-1">
      <p className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Recent</p>
      {isLoading ? (
        <p className="px-3 py-2 text-xs text-muted-foreground">Loading…</p>
      ) : data.length === 0 ? (
        <p className="px-3 py-2 text-xs text-muted-foreground">No recent activity yet.</p>
      ) : (
        data.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => { void navigate(`/variant/${r.variant_id}`) }}
            className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-xs hover:bg-surface-2"
          >
            <span className="min-w-0">
              <span className="block truncate font-medium text-foreground">{r.product_name}</span>
              <span className="block truncate text-[11px] text-muted-foreground">{r.variant_name}</span>
            </span>
            <span className="shrink-0 text-right">
              <span className={cn('block tabular-nums font-semibold', r.quantity_change < 0 ? 'text-red-500' : 'text-emerald-600')}>
                {r.quantity_change > 0 ? '+' : ''}{r.quantity_change}
              </span>
              <span className="block text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(r.timestamp), { addSuffix: true })}</span>
            </span>
          </button>
        ))
      )}
    </div>
  )
}

// Account avatar initials from the email local-part (jane.doe → JD; alice → AL).
function initialsFromEmail(email: string): string {
  const local = email.split('@')[0] ?? ''
  if (!local) return 'ME'
  const parts = local.split(/[._-]+/).filter(Boolean)
  const raw = parts.length >= 2 ? parts[0][0] + parts[1][0] : local.slice(0, 2)
  return raw.toUpperCase() || 'ME'
}

// Bottom-of-sidebar account menu (Foundry puts the account at the rail foot):
// who you're signed in as + settings + sign out. This is the only sign-out entry
// for non-scan roles now that the top bar is gone.
function AccountMenu() {
  const navigate = useNavigate()
  const email = useAuthStore((s) => s.session?.user.email ?? '')
  const role  = useAuthStore((s) => s.role)

  const signOut = async () => {
    try {
      await services.auth.signOut()
      void navigate('/login', { replace: true })
    } catch {
      toast.error('Failed to sign out')
    }
  }

  return (
    <Menu>
      <li className="px-2 py-1.5">
        <div className="max-w-[12rem] truncate text-xs font-medium text-foreground">{email || 'Signed in'}</div>
        {role && <div className="text-[11px] capitalize text-muted-foreground">{role.replace(/_/g, ' ')}</div>}
      </li>
      <MenuDivider />
      <MenuItem icon="cog" text="Account settings" onClick={() => { void navigate('/account') }} />
      <MenuItem icon="log-out" text="Sign out" onClick={() => { void signOut() }} />
    </Menu>
  )
}

// The retired dock's quick-actions, rehomed as a Foundry-style "+ New" menu.
// Role-aware: everyone can scan; managers also adjust stock + receive.
function QuickCreate() {
  const navigate = useNavigate()
  const role = useAuthStore((s) => s.role)
  const isManager = role != null && role !== 'team_member' && role !== 'limited_access'
  const go = (path: string) => () => { void navigate(path) }

  return (
    <Popover
      placement="right-start"
      content={
        <Menu>
          <MenuItem icon="barcode" text="Scan" onClick={go('/scan')} />
          {isManager && <MenuItem icon="plus" text="Adjust stock" onClick={go('/floor?panel=stock&action=adjust')} />}
          {isManager && <MenuItem icon="confirm" text="Receive delivery" onClick={go('/flow?panel=receive')} />}
        </Menu>
      }
    >
      <button
        type="button"
        className="flex w-full items-center justify-center gap-1.5 rounded bg-white/10 py-1.5 text-[13px] font-medium text-white transition-colors hover:bg-white/15"
      >
        <Icon icon="plus" size={14} /> New
      </button>
    </Popover>
  )
}
