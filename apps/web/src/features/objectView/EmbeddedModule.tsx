// A configured tab IS a Workshop module — rendered view-only inside the tab
// panel, header hidden (the Object View's own header stands above it).

import { NonIdealState, Spinner, SpinnerSize } from '@blueprintjs/core'
import { useModuleContents } from '@/features/workshop/api'
import { SectionTree } from '@/pages/WorkshopPage'

export function EmbeddedModule({ moduleId }: { moduleId: string }) {
  const { data: contents } = useModuleContents(moduleId)
  if (!contents) {
    return <div className="flex-1 flex items-center justify-center py-8"><Spinner size={SpinnerSize.SMALL} /></div>
  }
  const page = contents.pages.find((p) => p.isDefault) ?? contents.pages.at(0) ?? null
  if (page === null) {
    return <NonIdealState icon="page-layout" title="An empty module"
      description="Open it in Workshop to add pages and widgets." />
  }
  return (
    <div className="ws-canvas p-3">
      <SectionTree contents={contents} moduleId={moduleId}
        parent={{ pageId: page.id }} editing={false}
        selected={null} onSelect={() => undefined} />
    </div>
  )
}
