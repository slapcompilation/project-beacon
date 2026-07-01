// GlobalNav — wires the presentational FoundrySidebar into the app: maps each
// rail id to a route or a panel action, and derives the active item from the
// current URL. This is the Foundry-style left sidebar as the real global nav,
// replacing the bottom CommandDock (docs/AIP-UX-RESTRUCTURE.md, Phase 1).

import { useLocation, useNavigate } from 'react-router-dom'
import { FoundrySidebar } from './FoundrySidebar'
import { useAppStore } from '@/stores/app.store'

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
  if (pathname.startsWith('/system-map') || pathname.startsWith('/graph')) return 'objects'
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
      case 'objects':   void navigate('/system-map'); break
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
    />
  )
}
