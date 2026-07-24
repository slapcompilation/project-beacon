// Panel Object View (Studio P3.2) — Foundry's panel form factor: a record's
// Object View as a right-side slide-over, for when it's referenced elsewhere
// (e.g. a linked record). Self-contained: fetch record → resolve its type →
// render the dense RecordBody. Clicking a link swaps the panel to that record,
// so the ontology graph is walkable without leaving the page.

import { useState } from 'react'
import { Drawer, DrawerSize, Icon, Spinner, SpinnerSize, Tag } from '@blueprintjs/core'
import type { IconName } from '@blueprintjs/icons'
import { rowToObjectType } from '@/features/objectTypes/api'
import { useObjectTypes, useObjectRecord, useRecordLinks } from '@/features/objectTypes/hooks'
import { RecordBody } from './RecordBody'

export function RecordPanel({ recordId, onClose }: { recordId: string | null; onClose: () => void }) {
  // Local id lets link-clicks walk the graph within the open panel.
  const [innerId, setInnerId] = useState<string | null>(null)
  const activeId = innerId ?? recordId

  const { data: record, isLoading: recordLoading } = useObjectRecord(activeId)
  const { data: typeRows = [] } = useObjectTypes()
  const { data: links = [] } = useRecordLinks(activeId ?? '')
  const type = record ? typeRows.map(rowToObjectType).find((t) => t.id === record.object_type_id) : undefined

  const close = () => { setInnerId(null); onClose() }

  return (
    <Drawer isOpen={recordId !== null} onClose={close} size={DrawerSize.SMALL} position="right"
      title={type ? type.label : 'Record'} icon={(type?.icon ?? 'cube') as IconName}>
      <div className="flex-1 overflow-y-auto p-4">
        {recordLoading || !record || !type ? (
          <div className="flex h-40 items-center justify-center"><Spinner size={SpinnerSize.STANDARD} /></div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              {innerId && (
                <button type="button" className="text-muted-foreground hover:text-foreground" title="Back" onClick={() => { setInnerId(null) }}>
                  <Icon icon="arrow-left" size={14} />
                </button>
              )}
              <h2 className="text-sm font-semibold flex-1 truncate">{record.title}</h2>
              <Tag minimal className="!text-[10px] font-mono">{type.apiName}</Tag>
            </div>
            <RecordBody type={type} record={record} links={links} dense onOpenRecord={(id) => { setInnerId(id) }} />
          </div>
        )}
      </div>
    </Drawer>
  )
}
