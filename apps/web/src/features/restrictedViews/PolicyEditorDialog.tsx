// The restricted view policy editor with the three documented tabs —
// "Edit policy / View policy in JSON / Test policy" (restricted-views-4.png).
// Test policy answers as a named user through the same compiled predicate the
// readers use, so the tab cannot disagree with production.

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Button, Callout, Dialog, DialogBody, DialogFooter, HTMLSelect, Icon,
  Intent, Tab, Tabs, Tag,
} from '@blueprintjs/core'
import { client } from '@/lib/supabase/ontologyClient'
import { testRestrictedView } from '@beacon/platform'
import { useOrgMembers } from '@/features/projects/api'
import { PolicyComposer } from './PolicyComposer'
import { useDatasetFields, useUpdatePolicy, useViewMarkings, type Policy, type RestrictedView } from './api'

export function PolicyEditorDialog({ view, onClose }: { view: RestrictedView; onClose: () => void }) {
  const { data: columns = [] } = useDatasetFields(view.inputDatasetId)
  const { data: markings = [] } = useViewMarkings(view.id)
  const update = useUpdatePolicy(view.id)
  const [policy, setPolicy] = useState<Policy>(view.policy)
  const [tab, setTab] = useState('edit')

  return (
    <Dialog isOpen onClose={onClose} title={view.name} style={{ width: 640 }}>
      <DialogBody>
        <div className="flex items-center gap-2 mb-3 flex-wrap text-xs">
          <Icon icon="eye-off" size={13} className="text-violet-500" />
          <span className="text-muted-foreground">built on</span>
          <b>{view.inputDatasetName}</b>
          {markings.map((m) => <Tag key={m.id} minimal className="!text-[10px]">{m.name}</Tag>)}
          <span className="ml-auto font-mono text-[10px] text-muted-foreground">{view.rid}</span>
        </div>

        <Tabs id="policy-tabs" selectedTabId={tab} onChange={(t) => { setTab(String(t)) }}>
          <Tab id="edit" title="Edit policy" panel={
            <div className="space-y-3">
              <PolicyComposer policy={policy} columns={columns} onChange={setPolicy} />
              <Button intent={Intent.PRIMARY} size="small" icon="tick" loading={update.isPending}
                onClick={() => { update.mutate(policy) }}>
                Save policy
              </Button>
            </div>
          } />
          <Tab id="json" title="View policy in JSON" panel={
            <pre className="text-[11px] bg-muted rounded p-3 overflow-x-auto">
              {JSON.stringify(policy, null, 2)}
            </pre>
          } />
          <Tab id="test" title="Test policy" panel={<TestPolicyTab viewId={view.id} />} />
        </Tabs>
      </DialogBody>
      <DialogFooter actions={<Button onClick={onClose}>Close</Button>} />
    </Dialog>
  )
}

function TestPolicyTab({ viewId }: { viewId: string }) {
  const { data: people = [] } = useOrgMembers()
  const [userId, setUserId] = useState('')
  const { data, isFetching, error } = useQuery({
    queryKey: ['test-rv', viewId, userId],
    enabled: !!userId,
    queryFn: async () => {
      const rows = await client(testRestrictedView).executeFunction({ p_view: viewId, p_user: userId })
      return rows[0] ?? { visible_rows: 0, total_rows: 0 }
    },
    retry: false,
  })

  return (
    <div className="space-y-3">
      <label className="flex flex-col gap-1 max-w-64">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Test as</span>
        <HTMLSelect value={userId} onChange={(e) => { setUserId(e.currentTarget.value) }}>
          <option value="">Pick a user…</option>
          {people.map((p) => <option key={p.id} value={p.id}>{p.email}</option>)}
        </HTMLSelect>
      </label>
      {error !== null && <Callout intent={Intent.WARNING} className="!text-xs">{error.message}</Callout>}
      {data && !isFetching && (
        <Callout intent={data.visible_rows > 0 ? Intent.SUCCESS : Intent.WARNING} className="!text-xs">
          This user would see <b>{data.visible_rows}</b> of <b>{data.total_rows}</b> rows through the view
          — evaluated with the same compiled policy the readers apply.
        </Callout>
      )}
    </div>
  )
}
