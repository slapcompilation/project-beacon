// The platform's own chrome: dark, always left, on every authed route, with the
// application rendered to its right (readings/home-and-navigation.md §1, §3).
//
// Only entries that lead somewhere real are here. Omitted, and why:
//   §1  Notifications / What's New — no notification feed, no release notes.
//   §3  favourited Files — nothing stars a resource yet, so the group would
//       render its empty state forever. Applications favourites are here.
//   §5  AIP Assist, Support, Other Workspaces — nothing behind any of them.

import { useEffect, useState, type ReactElement } from 'react'
import { Icon, Menu, MenuDivider, MenuItem, Popover, Tooltip } from '@blueprintjs/core'
import type { IconName } from '@blueprintjs/icons'
import { useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { services } from '@/lib/services'
import { useAppStore } from '@/stores/app.store'
import { useAuthStore } from '@/stores/auth.store'
import { ALL_APPS, titleForPath } from './apps'
import { ApplicationsPortal } from './ApplicationsPortal'
import { usePlatformExperience } from './branding'
import { Quicksearch, MOD } from './Quicksearch'

export function PlatformSidebar() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const collapsed = useAppStore((s) => s.sidebarCollapsed)
  const toggle = useAppStore((s) => s.toggleSidebar)
  const recents = useAppStore((s) => s.recents)
  const favorites = useAppStore((s) => s.favoriteApps)
  const email = useAuthStore((s) => s.session?.user.email ?? '')
  const smallLogo = usePlatformExperience().data?.logos?.small
  const [portalOpen, setPortalOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)

  // Cmd/Ctrl+O collapses the sidebar; Cmd/Ctrl+J opens Quicksearch (§3, §8.2).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return
      const key = e.key.toLowerCase()
      if (key === 'o') { e.preventDefault(); toggle() }
      if (key === 'j') { e.preventDefault(); setSearchOpen(true) }
    }
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('keydown', onKey) }
  }, [toggle])

  const go = (path: string) => () => { void navigate(path) }

  const signOut = async () => {
    try {
      await services.auth.signOut()
      void navigate('/login', { replace: true })
    } catch {
      toast.error('Failed to sign out')
    }
  }

  const recentMenu = (
    <Menu>
      <MenuDivider title="Recent" />
      {recents.length === 0
        ? <MenuItem disabled text="Nothing visited yet" />
        : recents.map((path) => (
            <MenuItem key={path} icon="document" text={titleForPath(path) ?? path} label={path} onClick={go(path)} />
          ))}
    </Menu>
  )

  return (
    <aside className={cn('platform-sidebar', collapsed && 'is-collapsed')}>
      <div className="platform-head">
        <span className="platform-mark">
          {smallLogo
            ? <img src={smallLogo} alt="" className="platform-mark-img" />
            : <Icon icon="layers" size={13} color="#fff" />}
        </span>
        <button type="button" className="platform-collapse" onClick={toggle} title="Ctrl+O"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
          <Icon icon={collapsed ? 'menu-open' : 'menu-closed'} size={16} />
        </button>
      </div>

      <nav className="platform-nav">
        <div className="platform-group">
          <Row icon="home" label="Home" collapsed={collapsed} active={pathname === '/'} onClick={go('/')} />
          <Row icon="search" label="Search…" hint={`${MOD}J`} collapsed={collapsed}
            onClick={() => { setSearchOpen(true) }} />
        </div>
        <div className="platform-group">
          <Row icon="history" label="Recent" collapsed={collapsed} popover={recentMenu} />
          <Row icon="folder-close" label="Files" collapsed={collapsed}
            active={pathname.startsWith('/projects')} onClick={go('/projects')} />
          <Row icon="grid-view" label="Applications" collapsed={collapsed}
            onClick={() => { setPortalOpen(true) }} />
        </div>

        {/* Section ③ — starred applications. Absent when empty, the way
            Foundry's favourites groups are. */}
        {favorites.length > 0 && (
          <div className="platform-group">
            <div className="platform-section">
              <span>Applications</span>
              <button type="button" onClick={() => { setPortalOpen(true) }}>· View all</button>
            </div>
            {ALL_APPS.filter((a) => favorites.includes(a.path)).map((app) => (
              <Row key={app.path} icon={app.icon} label={app.name} collapsed={collapsed}
                active={pathname.startsWith(app.path)} onClick={go(app.path)} />
            ))}
          </div>
        )}
      </nav>

      <div className="platform-foot">
        {/* Foundry reaches Platform Settings via Account > Settings; ours is a
            sibling row because the Account row navigates rather than menus. */}
        <Row icon="cog" label="Settings" collapsed={collapsed}
          active={pathname.startsWith('/settings')} onClick={go('/settings')} />
        <Row avatar={initials(email)} label="Account" collapsed={collapsed}
          active={pathname.startsWith('/account')} onClick={go('/account')} />
        <Row icon="log-out" label="Sign out" collapsed={collapsed} onClick={() => { void signOut() }} />
      </div>

      <ApplicationsPortal isOpen={portalOpen} onClose={() => { setPortalOpen(false) }} />
      {/* Mounted only while open — its four hooks should not fetch on every page. */}
      {searchOpen && <Quicksearch onClose={() => { setSearchOpen(false) }} />}
    </aside>
  )
}

function Row({ icon, avatar, label, hint, active = false, collapsed, onClick, popover }: {
  icon?: IconName
  /** The Account row is the user's initials in a circle, not an icon (§3.2). */
  avatar?: string
  label: string
  /** Keyboard hints render inline, right-aligned (§3.2). */
  hint?: string
  active?: boolean
  collapsed: boolean
  onClick?: () => void
  popover?: ReactElement
}) {
  const button = (
    // Labelled explicitly: collapsed rows hide the text, and a nameless icon
    // button is unreachable by keyboard or screen reader.
    <button type="button" onClick={popover ? undefined : onClick} aria-label={label}
      className={cn('platform-row', active && 'is-active')}>
      {avatar ? <span className="platform-avatar">{avatar}</span> : icon && <Icon icon={icon} size={16} />}
      <span className="platform-row-label">{label}</span>
      {hint && <span className="platform-hint">{hint}</span>}
    </button>
  )

  if (popover) return <Popover fill content={popover} placement="right-start">{button}</Popover>
  if (collapsed) return <Tooltip fill compact content={label} placement="right">{button}</Tooltip>
  return button
}

// Initials from the email local part (jane.doe → JD, alice → AL).
function initials(email: string): string {
  const local = email.split('@')[0] ?? ''
  if (!local) return 'ME'
  const parts = local.split(/[._-]+/).filter(Boolean)
  const raw = parts.length >= 2 ? parts[0][0] + parts[1][0] : local.slice(0, 2)
  return raw.toUpperCase()
}
