// The builder for one module. Admin-gated at the route, and again by RLS —
// module_* tables carry admin-only FOR ALL policies, so a manager who reaches
// this URL gets a read-only canvas rather than a broken save.

import { useParams, Navigate } from 'react-router-dom'
import { NonIdealState } from '@blueprintjs/core'
import { useAuthStore } from '@/stores/auth.store'
import { ModuleBuilder } from '@/features/modules/builder/ModuleBuilder'

export default function ModuleBuilderPage() {
  const { apiName } = useParams<{ apiName: string }>()
  const role = useAuthStore((s) => s.role)

  if (!apiName) return <NonIdealState icon="application" title="No application named" />
  if (role !== 'owner' && role !== 'admin') return <Navigate to={`/modules/${apiName}`} replace />
  return <ModuleBuilder apiName={apiName} />
}
