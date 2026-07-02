// GlobalNav — wires the presentational FoundrySidebar into the app: maps each
// rail id to a route or a panel action, and derives the active item from the
// current URL. This is the Foundry-style left sidebar as the real global nav,
// replacing the bottom CommandDock (docs/AIP-UX-RESTRUCTURE.md, Phase 1).

import { useLocation, useNavigate } from 'react-router-dom'
import { Popover, Menu, MenuItem, Icon } from '@blueprintjs/core'
import { FoundrySidebar } from './FoundrySidebar'
import { useAppStore } from '@/stores/app.store'
import { useAuthStore } from '@/stores/auth.store'

// /mind hosts both Decisions (queue/approvals/cases) and Studio (builders); the
// ?aip= tab decides which rail item is active.
const STUDIO_AIP_TABS = new Set([
  'agents', 'system-map', 'ontology', 'tools', 'objectives', 'forecast-lab',
  'calibration', 'flywheel', 'monitors', 'documents', 'entity-links', 'answers',
  'principles', 'constraints', 'scenarios', 'action-chains', 'copilot', 'policy',
])

function activeIdFor(pathname: string, search: string): string {
  if (pathname.startsWith('/briefing')) return 'home'
  if (pathname.startsWith('/applications')) return 'apps'
  if (pathname.startsWith('/graph')) return 'objects'
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

  const onSelect = (id: string) => {
    switch (id) {
      case 'home':      void navigate('/briefing'); break
      case 'search':    toggleCommandBar(); break
      case 'notifs':    setNotifPanelOpen(true); break
      case 'whatsnew':  void navigate('/notifications'); break
      case 'recent':    toggleCommandBar(); break
      case 'objects':   void navigate('/graph'); break
      case 'apps':      void navigate('/applications'); break
      case 'decisions': void navigate('/mind?aip=queue'); break
      case 'insights':  void navigate('/eye'); break
      case 'studio':    void navigate('/mind?aip=agents'); break
      case 'copilot':   toggleCopilot(); break
      case 'support':   void navigate('/settings'); break
      case 'account':   void navigate('/account'); break
    }
  }

  return (
    <FoundrySidebar
      activeId={activeIdFor(pathname, search)}
      onSelect={onSelect}
      headerSlot={<QuickCreate />}
    />
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
