// Operations — the hospitality procurement / finance / strategy workspace.
// A peer dock surface, not a sub-tab of the AI module: a whole app shouldn't
// live inside Mind. Reuses the self-contained OperationsPanel; ?panel=<x> seeds
// the initial tab (legacy /mind?panel=<x> links redirect here).

import { useSearchParams } from 'react-router-dom'
import { NonIdealState } from '@blueprintjs/core'
import { useAuthStore } from '@/stores/auth.store'
import { OperationsPanel } from '@/features/mind/OperationsPanel'

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

  return <OperationsPanel initialPanel={params.get('panel') ?? undefined} />
}
