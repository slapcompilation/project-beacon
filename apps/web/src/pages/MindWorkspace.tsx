// Mind — the AIP module. The shell IS the AIP workspace (AIPShell): a
// decision-loop rail fronted by a Command landing. Hospitality procurement /
// finance / strategy is demoted to the "Operations" rail entry.
//
// URL: ?aip=<tab> drives the rail. Legacy ?panel=<x> deep links (procurement,
// contracts, suppliers, …) resolve to the Operations tab, seeded to the right
// sub-tab so old links from object pages + briefing actions keep working.

import { useSearchParams } from 'react-router-dom'
import { NonIdealState } from '@blueprintjs/core'
import { useAuthStore } from '@/stores/auth.store'
import AIPShell, { isAipTab, type AipTab } from '@/features/mind/AIPShell'

export default function MindWorkspace() {
  const role = useAuthStore((s) => s.role ?? 'limited_access')
  const [params, setParams] = useSearchParams()

  if (role !== 'admin' && role !== 'owner') {
    return (
      <NonIdealState
        icon="lightbulb"
        title="Mind layer is available to admin and owner roles only"
      />
    )
  }

  const aipParam   = params.get('aip')
  const panelParam = params.get('panel')

  // Resolve the active rail tab. A legacy hospitality ?panel= (anything other
  // than the old 'aip' top-level) lands on Operations with the value forwarded
  // for sub-tab seeding.
  let tab: AipTab
  let operationsInitialPanel: string | undefined
  if (isAipTab(aipParam)) {
    tab = aipParam
  } else if (panelParam && panelParam !== 'aip') {
    tab = 'operations'
    operationsInitialPanel = panelParam
  } else {
    tab = 'command'
  }

  return (
    <AIPShell
      tab={tab}
      operationsInitialPanel={operationsInitialPanel}
      onTabChange={(t) => { setParams({ aip: t }, { replace: true }) }}
    />
  )
}
