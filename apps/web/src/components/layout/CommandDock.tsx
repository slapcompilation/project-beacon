// Layer: meta — bottom command dock (three-zone layout)
// Replaces: sidebar nav + QuickActions FAB + TelemetryBar status dots.
// Left: layer navigation (Canvas/Floor/Flow/Eye/Mind). Right: contextual quick actions.

import { memo, useMemo } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  BookOpen, ScanLine, ArrowLeftRight, Eye, Brain,
  Plus, PackageCheck, ScanBarcode,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth.store'
import { useBriefingActions } from '@/features/briefing/hooks'
import { useRealtimeStatus, type RealtimeStatus } from '@/hooks/useRealtimeStatus'

// ─── Status dot ───────────���──────────────────────────��───────────────────────

const STATUS_COLOR: Record<RealtimeStatus, string> = {
  connected:    'bg-emerald-500',
  connecting:   'bg-amber-500 animate-pulse',
  disconnected: 'bg-red-500',
}

// ─── Nav item ────────────────────���──────────────────────��────────────────────

interface DockNavItem {
  to: string
  label: string
  icon: React.ElementType
  color: string
  badge?: number
}

function DockLink({ to, label, icon: Icon, color, badge }: DockNavItem) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          'flex flex-col items-center gap-0.5 px-2.5 py-1 rounded-lg text-[10px] font-medium transition-colors relative min-w-[3rem]',
          isActive
            ? 'text-foreground'
            : 'text-muted-foreground/70 hover:text-foreground',
        )
      }
    >
      {({ isActive }) => (
        <>
          <div className="relative">
            <Icon className={cn('h-4.5 w-4.5', isActive ? color : '')} />
            {badge != null && badge > 0 && (
              <span className="absolute -right-1.5 -top-1 flex h-3 min-w-[0.75rem] items-center justify-center rounded-full bg-red-500 px-0.5 text-[7px] font-bold text-white leading-none">
                {badge > 99 ? '99+' : badge}
              </span>
            )}
          </div>
          <span className={cn('hidden sm:block', isActive && 'font-semibold')}>{label}</span>
          {isActive && (
            <span className={cn('absolute -top-0.5 left-1/2 -translate-x-1/2 h-0.5 w-5 rounded-full', color.replace('text-', 'bg-'))} />
          )}
        </>
      )}
    </NavLink>
  )
}

// ─── Quick action button ──────────────────────────────────────────────────────

function QuickButton({ icon: Icon, label, onClick }: { icon: React.ElementType; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-medium text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors whitespace-nowrap"
    >
      <Icon className="h-3.5 w-3.5" />
      <span className="hidden sm:block">{label}</span>
    </button>
  )
}

// ─── Quick action config map ─────────────────────────────────────────────────

interface QuickActionDef {
  icon: React.ElementType
  label: string
  path: string
}

const ROUTE_ACTIONS: { pattern: string; actions: QuickActionDef[] }[] = [
  { pattern: '/floor', actions: [
    { icon: Plus, label: '+Stock', path: '/floor?panel=stock&action=adjust' },
    { icon: ScanBarcode, label: 'Scan', path: '/scan' },
  ]},
  { pattern: '/flow', actions: [
    { icon: PackageCheck, label: 'Receive', path: '/flow?panel=receive' },
    { icon: ScanBarcode, label: 'Scan', path: '/scan' },
  ]},
]

const DEFAULT_MANAGER: QuickActionDef[] = [
  { icon: Plus, label: '+Stock', path: '/floor?panel=stock&action=adjust' },
  { icon: PackageCheck, label: 'Receive', path: '/flow?panel=receive' },
  { icon: ScanBarcode, label: 'Scan', path: '/scan' },
]

const DEFAULT_STAFF: QuickActionDef[] = [
  { icon: ScanBarcode, label: 'Scan', path: '/scan' },
]

function getQuickActions(pathname: string, isManager: boolean): QuickActionDef[] {
  const match = ROUTE_ACTIONS.find((r) => pathname.startsWith(r.pattern))
  if (match) return match.actions
  return isManager ? DEFAULT_MANAGER : DEFAULT_STAFF
}

// ─── CommandDock ───────────────────���──────────────────────────────────────────

export const CommandDock = memo(function CommandDock() {
  const role     = useAuthStore((s) => s.role)
  const navigate = useNavigate()
  const location = useLocation()
  const status   = useRealtimeStatus()
  const { data: briefingActions = [] } = useBriefingActions()

  const isLimitedAccess = role === 'limited_access'
  const isStaff         = role === 'team_member'
  const isManager       = !isLimitedAccess && !isStaff
  const isOwnerOrAdmin  = role === 'owner' || role === 'admin'

  // Badge counts from briefing (act-now only)
  const badges = useMemo(() => {
    const actNow = briefingActions.filter((a) => a.priority <= 1)
    return {
      total: actNow.length,
      flow: actNow.filter((a) =>
        a.action_type === 'low_stock_no_po' || a.action_type === 'restock_proposal'
      ).length,
      eye: actNow.filter((a) =>
        a.action_type === 'waste_spike_low_occupancy' || a.action_type === 'expiry_soon'
      ).length,
      mind: actNow.filter((a) =>
        a.action_type === 'invoice_discrepancy' ||
        a.action_type === 'supplier_risk' ||
        a.action_type === 'gl_unmapped'
      ).length,
    }
  }, [briefingActions])

  const pathname     = location.pathname
  const quickActions = getQuickActions(pathname, isManager)

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 flex h-12 items-center border-t border-border bg-surface-1 px-1 sm:px-3">
      {/* ── Status dot (leftmost) ��─────────────────────────────────── */}
      <div className="flex items-center px-1.5 shrink-0" title={`Realtime: ${status}`}>
        <span className={cn('h-1.5 w-1.5 rounded-full', STATUS_COLOR[status])} />
      </div>

      {/* ── Layer navigation ──────���────────────────────────────────── */}
      <div className="flex items-center gap-0.5 flex-1">
        {isManager && (
          <DockLink to="/briefing" label="Canvas" icon={BookOpen} color="text-foreground" badge={badges.total || undefined} />
        )}
        <DockLink to="/floor" label="Floor" icon={ScanLine} color="text-emerald-500" />
        {isManager && (
          <DockLink to="/flow" label="Flow" icon={ArrowLeftRight} color="text-blue-500" badge={badges.flow || undefined} />
        )}
        {isManager && (
          <DockLink to="/eye" label="Eye" icon={Eye} color="text-amber-500" badge={badges.eye || undefined} />
        )}
        {isOwnerOrAdmin && (
          <DockLink to="/mind" label="Mind" icon={Brain} color="text-purple-500" badge={badges.mind || undefined} />
        )}
      </div>

      {/* ── Separator ──────────────────────────────────────────────── */}
      <div className="h-5 w-px bg-border/60 mx-1 shrink-0" />

      {/* ── Contextual quick actions ─────────────────────────────── */}
      <div className="flex items-center gap-0.5 shrink-0">
        {quickActions.map((qa) => (
          <QuickButton key={qa.path} icon={qa.icon} label={qa.label} onClick={() => { navigate(qa.path) }} />
        ))}
      </div>
    </nav>
  )
})
