// Operations — the hospitality procurement / finance / strategy workspace.
// A peer dock surface, not a sub-tab of the AI module: a whole app shouldn't
// live inside Mind. Reuses the self-contained OperationsPanel; ?panel=<x> seeds
// the initial tab (legacy /mind?panel=<x> links redirect here).

import { Navigate, useSearchParams } from 'react-router-dom'
import { NonIdealState } from '@blueprintjs/core'
import { useAuthStore } from '@/stores/auth.store'
import { OperationsPanel } from '@/features/mind/OperationsPanel'

// Finance + Strategy left Operations for Insights lenses (P3). Old ?panel= deep
// links from object pages / briefing / bookmarks forward to the new home.
const RELOCATED: Record<string, string> = {
  finance:      '/eye?panel=cpor',
  financial:    '/eye?panel=cpor',
  cpor:         '/eye?panel=cpor',
  budget:       '/eye?panel=budget',
  gl:           '/eye?panel=gl',
  intelligence: '/eye?panel=fb',
  strategy:     '/eye?panel=chain',
  chain:        '/eye?panel=chain',
  team:         '/eye?panel=team',
}

export default function OperationsWorkspace() {
  const role = useAuthStore((s) => s.role ?? 'limited_access')
  const [params] = useSearchParams()

  if (role !== 'admin' && role !== 'owner') {
    return (
      <NonIdealState
        icon="shop"
        title="Operations is available to admin and owner roles only"
      />
    )
  }

  const panel = params.get('panel') ?? ''
  const relocated = RELOCATED[panel]
  if (relocated) return <Navigate to={relocated} replace />

  return <OperationsPanel initialPanel={params.get('panel') ?? undefined} />
}
