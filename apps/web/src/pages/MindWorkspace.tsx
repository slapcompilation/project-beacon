// Mind — the AIP module. The shell IS the AIP workspace (AIPShell): a
// decision-loop rail fronted by a Command landing.
//
// URL: ?aip=<tab> drives the rail. Hospitality procurement / finance / strategy
// is now its own dock surface (/operations), so a legacy ?panel=<x> deep link
// (procurement, contracts, suppliers, …) redirects there — old links from
// object pages + briefing actions keep working.

import { Navigate, useSearchParams } from 'react-router-dom'
import { NonIdealState } from '@blueprintjs/core'
import { useAuthStore } from '@/stores/auth.store'
import AIPShell, { isAipTab } from '@/features/mind/AIPShell'

export default function MindWorkspace() {
  const role = useAuthStore((s) => s.role ?? 'limited_access')
  const [params, setParams] = useSearchParams()

  const isOwnerOrAdmin = role === 'owner' || role === 'admin'
  // The Decisions inbox is the daily driver for anyone with approval authority —
  // gating it to owner/admin is what forced the parallel approval UIs elsewhere.
  // Studio (build/configure) stays owner/admin; floor staff use the Floor layer.
  const canDecide = role !== 'limited_access' && role !== 'team_member'

  if (!canDecide) {
    return (
      <NonIdealState
        icon="inbox"
        title="Decisions is available to managers and above"
      />
    )
  }

  const aipParam   = params.get('aip')
  const panelParam = params.get('panel')

  // Legacy hospitality ?panel= now lives at /operations — forward it.
  if (!isAipTab(aipParam) && panelParam && panelParam !== 'aip') {
    return <Navigate to={`/operations?panel=${panelParam}`} replace />
  }

  const tab = isAipTab(aipParam) ? aipParam : 'queue'

  return (
    <AIPShell
      tab={tab}
      onTabChange={(t) => { setParams({ aip: t }, { replace: true }) }}
      allowStudio={isOwnerOrAdmin}
    />
  )
}
