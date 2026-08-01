// A built application. The route is generic on purpose — /modules/:apiName
// serves every module, because adding one must not mean adding a route.

import { useParams } from 'react-router-dom'
import { NonIdealState } from '@blueprintjs/core'
import { ModuleRenderer } from '@/features/modules/ModuleRenderer'

export default function ModulePage() {
  const { apiName } = useParams<{ apiName: string }>()
  if (!apiName) {
    return <NonIdealState icon="application" title="No application named" />
  }
  return <ModuleRenderer apiName={apiName} />
}
