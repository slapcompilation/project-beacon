// The OMA's Object views tab (the capture places it beside Capabilities):
// the standard view needs no configuration; the configured view is authored
// here — created (the detach moment) and given tabs, each a Workshop module.

import { useState } from 'react'
import {
  Button, Card, Dialog, DialogBody, HTMLSelect, Icon, InputGroup, Intent, Tag,
} from '@blueprintjs/core'
import type { ObjectTypeDef } from '@beacon/ontology'
import { useAuthStore } from '@/stores/auth.store'
import { useWorkshopModules } from '@/features/workshop/api'
import {
  useObjectViewFor, useObjectViewTabs, useCreateObjectView,
  useAddObjectViewTab, useRemoveObjectViewTab, type ObjectViewTab as TabRow,
} from './api'

export function ObjectViewsTab({ type }: { type: ObjectTypeDef }) {
  const { data: view, isLoading } = useObjectViewFor(type.id)
  const create = useCreateObjectView(type.id)
  return (
    <div className="space-y-3 pt-2">
      <Card compact>
        <div className="flex items-center gap-2">
          <Icon icon="grid-view" size={13} className="text-muted-foreground" />
          <div className="flex-1">
            <p className="text-sm font-semibold">Standard view</p>
            <p className="text-xs text-muted-foreground">
              Computed from the type — prominent properties (or all non-hidden), links,
              actions, edit history. Nothing to configure; it updates with the type.
            </p>
          </div>
          <Tag minimal className="!text-[9px]">{view ? 'one toggle away' : 'the default'}</Tag>
        </div>
      </Card>
      {isLoading ? null : view ? (
        <ConfiguredEditor type={type} viewId={view.id} version={view.version} />
      ) : (
        <Card compact className="flex items-center gap-2">
          <Icon icon="manual" size={13} className="text-violet-500" />
          <div className="flex-1">
            <p className="text-sm font-semibold">Configured view</p>
            <p className="text-xs text-muted-foreground">
              None yet. Creating one makes it the default view for users — the standard
              view stays one toggle away — and its tabs are Workshop modules.
            </p>
          </div>
          <Button size="small" icon="plus" loading={create.isPending}
            onClick={() => { create.mutate() }}>Create configured view</Button>
        </Card>
      )}
    </div>
  )
}

function ConfiguredEditor({ type, viewId, version }: {
  type: ObjectTypeDef; viewId: string; version: number
}) {
  const { data: tabs = [] } = useObjectViewTabs(viewId)
  const remove = useRemoveObjectViewTab(viewId)
  const [adding, setAdding] = useState(false)
  return (
    <Card compact className="space-y-2">
      <div className="flex items-center gap-2">
        <Icon icon="manual" size={13} className="text-violet-500" />
        <span className="text-sm font-semibold">Configured view</span>
        <Tag minimal className="!text-[9px]">v{version}</Tag>
        <div className="flex-1" />
        <Button size="small" icon="plus" onClick={() => { setAdding(true) }}>Add tab</Button>
      </div>
      {tabs.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No tabs yet — the view renders empty until one is added.
        </p>
      ) : tabs.map((t: TabRow) => (
        <div key={t.id} className="flex items-center gap-2 text-xs">
          <Icon icon="page-layout" size={11} />
          <span className="font-medium">{t.title}</span>
          {/* The id is generated on creation and cannot be edited. */}
          <span className="font-mono text-muted-foreground">{t.tabId}</span>
          <Tag minimal className="!text-[9px]">
            {t.kind === 'managed_workshop' ? 'Managed Workshop' : 'Standalone Workshop'}
          </Tag>
          <Button variant="minimal" size="small" icon="cross" className="ml-auto"
            onClick={() => { remove.mutate(t.id) }} />
        </div>
      ))}
      <AddTabDialog type={type} viewId={viewId} open={adding} onClose={() => { setAdding(false) }} />
    </Card>
  )
}

function AddTabDialog({ type, viewId, open, onClose }: {
  type: ObjectTypeDef; viewId: string; open: boolean; onClose: () => void
}) {
  const organizationId = useAuthStore((s) => s.organizationId)
  const { data: modules = [] } = useWorkshopModules()
  const add = useAddObjectViewTab(viewId, type.id)
  const [title, setTitle] = useState('')
  const [kind, setKind] = useState<TabRow['kind']>('managed_workshop')
  const [moduleId, setModuleId] = useState('')
  return (
    <Dialog isOpen={open} onClose={onClose} title="Add tab">
      <DialogBody>
        <div className="space-y-3">
          <InputGroup placeholder="Tab title" value={title}
            onChange={(e) => { setTitle(e.currentTarget.value) }} />
          {/* "two types of tabs...: Managed Workshop, and Standalone Workshop
              modules" — managed is built for this view and not reusable;
              standalone shows an existing module. */}
          <HTMLSelect fill value={kind}
            onChange={(e) => { setKind(e.currentTarget.value as TabRow['kind']) }}>
            <option value="managed_workshop">Managed Workshop module (new, owned by this view)</option>
            <option value="standalone_workshop">Standalone Workshop module (existing)</option>
          </HTMLSelect>
          {kind === 'standalone_workshop' && (
            <HTMLSelect fill value={moduleId} onChange={(e) => { setModuleId(e.currentTarget.value) }}>
              <option value="">Module…</option>
              {modules.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </HTMLSelect>
          )}
          <Button intent={Intent.PRIMARY}
            disabled={title.trim() === '' || (kind === 'standalone_workshop' && moduleId === '')}
            loading={add.isPending}
            onClick={() => {
              add.mutate({
                title: title.trim(), kind,
                moduleId: kind === 'standalone_workshop' ? moduleId : undefined,
                organizationId, projectId: null,
              }, { onSuccess: () => { setTitle(''); onClose() } })
            }}>Add tab</Button>
        </div>
      </DialogBody>
    </Dialog>
  )
}
