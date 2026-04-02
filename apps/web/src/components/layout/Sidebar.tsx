// Layer: meta — navigation shell
// 5 nav items. No collapsibles. The layers ARE the destinations.
// Palantir principle: operators navigate to workspaces, not pages.

import { useEffect, useCallback, useMemo } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  Settings, LogOut, Building2, ChevronDown,
  BellDot, ArrowLeftRight, Eye, Brain,
  ScanLine, X, Command,
  SlidersHorizontal, Monitor, AlignJustify, Languages,
  BookOpen,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { services } from '@/lib/services'
import { useAuthStore } from '@/stores/auth.store'
import { useAppStore } from '@/stores/app.store'
import { useHotels } from '@/features/hotel/hooks'
import { useActiveHotelId } from '@/hooks/useActiveHotelId'
import { useAlertCount } from '@/hooks/useAlertCount'
import { useUnreadNotificationCount } from '@/features/notifications/hooks'
import { useUserPrefs, useUpdateUserPrefs } from '@/features/user/hooks'
import { useBriefingActions } from '@/features/briefing/hooks'
import { DATE_FORMATS } from '@/lib/date'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'

// ─── Nav link ─────────────────────────────────────────────────────────────────

interface NavItem {
  to: string
  label: string
  icon: React.ElementType
  badge?: number | string
}

function SidebarLink({ to, label, icon: Icon, badge }: NavItem) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors',
          isActive
            ? 'bg-slate-700 text-white'
            : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100',
        )
      }
    >
      <Icon className="h-4 w-4 flex-shrink-0" />
      <span className="flex-1 truncate">{label}</span>
      {badge != null && badge !== 0 && badge !== '' && (
        <span className="flex h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white leading-none">
          {typeof badge === 'number' && badge > 99 ? '99+' : badge}
        </span>
      )}
    </NavLink>
  )
}

// ─── Preferences Popover ──────────────────────────────────────────────────────

function PrefsPopover({ email }: { email: string }) {
  const { data: prefs } = useUserPrefs()
  const update   = useUpdateUserPrefs()
  const setTheme = useAppStore((s) => s.setTheme)

  const syncTheme = useCallback(() => {
    if (prefs?.theme) setTheme(prefs.theme)
  }, [prefs?.theme, setTheme])
  useEffect(syncTheme, [syncTheme])

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-slate-800"
        >
          <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-slate-700 text-[10px] font-semibold text-slate-200 uppercase">
            {email.charAt(0)}
          </div>
          <span className="flex-1 truncate text-[11px] text-slate-400">{email}</span>
          <SlidersHorizontal className="h-3 w-3 flex-shrink-0 text-slate-600" />
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" align="end" sideOffset={8} className="w-56 p-3 space-y-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-1 pb-1 border-b">
          Preferences
        </p>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm">
            <Monitor className="h-3.5 w-3.5 text-muted-foreground" />
            <Label className="text-xs cursor-pointer">Theme</Label>
          </div>
          <Select
            value={prefs?.theme ?? 'system'}
            onValueChange={(v) => {
              const t = v as 'light' | 'dark' | 'system'
              setTheme(t)
              update.mutate({ theme: t })
            }}
          >
            <SelectTrigger className="h-7 w-24 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="system">System</SelectItem>
              <SelectItem value="light">Light</SelectItem>
              <SelectItem value="dark">Dark</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlignJustify className="h-3.5 w-3.5 text-muted-foreground" />
            <Label className="text-xs cursor-pointer">Date format</Label>
          </div>
          <Select
            value={prefs?.date_format ?? 'dd/MM/yyyy'}
            onValueChange={(v) => { update.mutate({ date_format: v }) }}
          >
            <SelectTrigger className="h-7 w-32 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {DATE_FORMATS.map((f) => (
                <SelectItem key={f.value} value={f.value}>
                  <span className="font-mono text-xs">{f.example}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Languages className="h-3.5 w-3.5 text-muted-foreground" />
            <Label className="text-xs cursor-pointer">Language</Label>
          </div>
          <Select
            value={prefs?.language ?? 'en'}
            onValueChange={(v) => { update.mutate({ language: v }) }}
          >
            <SelectTrigger className="h-7 w-24 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="el">Ελληνικά</SelectItem>
              <SelectItem value="de">Deutsch</SelectItem>
              <SelectItem value="fr">Français</SelectItem>
              <SelectItem value="es">Español</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center justify-between gap-3">
          <Label className="text-xs cursor-pointer flex items-center gap-2">
            <AlignJustify className="h-3.5 w-3.5 text-muted-foreground" />
            Compact tables
          </Label>
          <Switch
            checked={prefs?.compact_view ?? false}
            onCheckedChange={(v) => { update.mutate({ compact_view: v }) }}
            className="scale-75 origin-right"
          />
        </div>
      </PopoverContent>
    </Popover>
  )
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

export function Sidebar({ onClose }: { onClose?: () => void }) {
  const navigate = useNavigate()
  const email    = useAuthStore((s) => s.session?.user.email ?? '')
  const role     = useAuthStore((s) => s.role)
  const activeHotelId = useActiveHotelId()
  const { data: hotels = [] } = useHotels()
  const activeHotel = hotels.find((h) => h.id === activeHotelId)

  const alertCount       = useAlertCount()
  const unreadNotifCount = useUnreadNotificationCount()
  const { data: briefingActions = [] } = useBriefingActions()

  const setActiveHotelId  = useAppStore((s) => s.setActiveHotelId)
  const setNotifPanelOpen = useAppStore((s) => s.setNotifPanelOpen)

  const isLimitedAccess = role === 'limited_access'
  const isStaff         = role === 'team_member'
  const isOwnerOrAdmin  = role === 'owner' || role === 'admin'
  const isManager       = !isLimitedAccess && !isStaff

  // Live badge counts derived from the briefing feed (act-now only)
  const badges = useMemo(() => {
    const actNow = briefingActions.filter((a) => a.priority <= 1)
    return {
      total: actNow.length,
      flow:  actNow.filter((a) =>
        a.action_type === 'low_stock_no_po' || a.action_type === 'restock_proposal'
      ).length,
      eye:   actNow.filter((a) =>
        a.action_type === 'waste_spike_low_occupancy' || a.action_type === 'expiry_soon'
      ).length,
      mind:  actNow.filter((a) =>
        a.action_type === 'invoice_discrepancy' ||
        a.action_type === 'supplier_risk' ||
        a.action_type === 'gl_unmapped'
      ).length,
    }
  }, [briefingActions])

  const handleSignOut = async () => {
    try {
      await services.auth.signOut()
      void navigate('/login', { replace: true })
    } catch {
      toast.error('Failed to sign out')
    }
  }

  const openCommandBar = () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }))
  }

  return (
    <aside className="flex h-screen w-56 flex-shrink-0 flex-col bg-slate-900 text-slate-100">

      {/* Logo + hotel switcher + ⌘K */}
      <div className="flex h-14 items-center gap-2 px-3 border-b border-slate-800">
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="lg:hidden flex-shrink-0 rounded p-1 text-slate-500 hover:bg-slate-800 hover:text-slate-300 transition-colors"
            aria-label="Close navigation"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        <span className="text-base font-bold tracking-tight text-white">Beacon</span>
        {hotels.length > 1 ? (
          <DropdownMenu>
            <DropdownMenuTrigger className="ml-auto flex items-center gap-1 rounded px-1.5 py-1 text-xs text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition-colors max-w-[90px]">
              <Building2 className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">{activeHotel?.name ?? '…'}</span>
              <ChevronDown className="h-2.5 w-2.5 flex-shrink-0" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {hotels.map((h) => (
                <DropdownMenuItem
                  key={h.id}
                  onClick={() => { setActiveHotelId(h.id) }}
                  className={h.id === activeHotelId ? 'font-semibold' : ''}
                >
                  {h.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : activeHotel ? (
          <span className="ml-auto text-[10px] text-slate-600 truncate max-w-[80px]">{activeHotel.name}</span>
        ) : null}
        <button
          type="button"
          onClick={openCommandBar}
          title="Command bar (⌘K)"
          className="ml-auto flex-shrink-0 rounded p-1 text-slate-500 hover:bg-slate-800 hover:text-slate-300 transition-colors"
        >
          <Command className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* ── Five-item nav ─────────────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">

        {isManager && (
          <SidebarLink
            to="/briefing"
            label="Briefing"
            icon={BookOpen}
            badge={badges.total || undefined}
          />
        )}

        <SidebarLink to="/floor" label="Floor" icon={ScanLine} />

        {isManager && (
          <SidebarLink
            to="/flow"
            label="Flow"
            icon={ArrowLeftRight}
            badge={badges.flow || undefined}
          />
        )}

        {isManager && (
          <SidebarLink
            to="/eye"
            label="Eye"
            icon={Eye}
            badge={badges.eye || undefined}
          />
        )}

        {isOwnerOrAdmin && (
          <SidebarLink
            to="/mind"
            label="Mind"
            icon={Brain}
            badge={badges.mind || undefined}
          />
        )}

        {/* ── Utility items ─────────────────────────────────────────────── */}
        <div className="pt-3 border-t border-slate-800/60 mt-3 space-y-0.5">
          <button
            type="button"
            onClick={() => { setNotifPanelOpen(true) }}
            className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors text-slate-400 hover:bg-slate-800 hover:text-slate-100"
          >
            <BellDot className="h-4 w-4 flex-shrink-0" />
            <span className="flex-1 text-left">Notifications</span>
            {(alertCount + unreadNotifCount) > 0 && (
              <span className="flex h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white leading-none">
                {(alertCount + unreadNotifCount) > 99 ? '99+' : alertCount + unreadNotifCount}
              </span>
            )}
          </button>

          <SidebarLink to="/settings" label="Settings" icon={Settings} />
        </div>
      </nav>

      {/* Footer — preferences + sign out */}
      <div className="border-t border-slate-800 px-2 py-2 space-y-0.5">
        <PrefsPopover email={email} />
        <button
          onClick={() => { void handleSignOut() }}
          className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-100"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </aside>
  )
}
