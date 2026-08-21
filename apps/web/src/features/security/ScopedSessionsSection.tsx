// Scoped sessions in Platform Settings: the three toggles and the Session
// presets list, plus the New scoped session dialog drawn as
// new_scoped_session_dialog.png draws it.
//
// The dialog: Name with a helper, "Description (optional)" with the word
// optional set apart, a Marking search, markings grouped under their CATEGORY
// as a bold header with a shield pill and a description line each, and the
// footer sentence that states the invariant — which is on the screenshot and
// belongs on ours, because it is the thing an admin gets wrong.
import { useState } from 'react'
import {
  Button, Callout, Card, Checkbox, Dialog, DialogBody, DialogFooter, Icon,
  InputGroup, Intent, Switch, Tag, TextArea,
} from '@blueprintjs/core'
import { useAuthStore } from '@/stores/auth.store'
import { useAllMarkings, type MarkingPick } from '@/features/lineage/api'
import {
  useCreateScopedSession, useDeleteScopedSession, useScopedSessions,
  useSessionSettings, useSetSessionSettings,
} from '@/features/security/scopedSessions'

export function ScopedSessionsSection() {
  const orgId = useAuthStore((s) => s.organizationId)
  const isAdmin = useAuthStore((s) => s.role === 'owner' || s.role === 'admin')
  const { data: settings } = useSessionSettings(orgId)
  const set = useSetSessionSettings(orgId)
  const { data: presets = [] } = useScopedSessions()
  const { data: markings = [] } = useAllMarkings()
  const del = useDeleteScopedSession()
  const [creating, setCreating] = useState(false)

  const named = new Map(markings.map((m) => [m.id, m]))

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold">Scoped sessions</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Limit a person's access to markings to a pre-defined set based on a defined focus of
          work. A session never grants a marking — it can only narrow what an existing member
          sees, and unmarked resources stay visible.
        </p>
      </div>

      <Card compact className="space-y-2">
        <Switch checked={settings?.enabled ?? false} disabled={!isAdmin} className="mb-0"
          label="Scoped sessions"
          onChange={(e) => { set.mutate({ enabled: e.currentTarget.checked }) }} />
        <p className="text-xs text-muted-foreground -mt-1">
          When enabled, people must select a scoped session to limit their access to a subset of
          their full user access.
        </p>
        <Switch checked={settings?.allowNoSession ?? false} disabled={!isAdmin} className="mb-0"
          label="Allow no scoped session"
          onChange={(e) => { set.mutate({ allow_no_session: e.currentTarget.checked }) }} />
        <p className="text-xs text-muted-foreground -mt-1">
          When enabled, people can use the platform without a scoped session and have access to
          all markings they are a member of.
        </p>
        <Switch checked={settings?.alwaysShowSelector ?? false} disabled={!isAdmin} className="mb-0"
          label="Always show selector"
          onChange={(e) => { set.mutate({ always_show_selector: e.currentTarget.checked }) }} />
        <p className="text-xs text-muted-foreground -mt-1">
          When enabled, people always see the selector when logging in, even when only one session
          is available to them.
        </p>
      </Card>

      <div className="flex items-center gap-2">
        <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          Session presets
        </span>
        {isAdmin && (
          <Button variant="minimal" size="small" icon="add" className="ml-auto"
            onClick={() => { setCreating(true) }}>New scoped session</Button>
        )}
      </div>

      {presets.length === 0 ? (
        <Card compact className="text-xs text-muted-foreground">
          No presets. A person with no session sees everything they are a member of.
        </Card>
      ) : (
        <Card compact className="!p-0">
          <ul className="divide-y divide-border/30">
            {presets.map((s) => (
              <li key={s.id} className="px-3 py-2 text-xs">
                <div className="flex items-center gap-2">
                  <Icon icon="shield" size={12} className="text-violet-500 shrink-0" />
                  <span className="font-medium">{s.name}</span>
                  <span className="flex-1 truncate text-muted-foreground">{s.description}</span>
                  {isAdmin && (
                    <Button variant="minimal" size="small" icon="trash" title="Delete"
                      onClick={() => { del.mutate(s.id) }} />
                  )}
                </div>
                <div className="flex flex-wrap gap-1 mt-1 pl-5">
                  {s.markingIds.map((id) => (
                    <Tag key={id} minimal icon="shield">
                      {named.get(id) ? `${named.get(id)?.category}: ${named.get(id)?.name}` : id}
                    </Tag>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {creating && (
        <NewSessionDialog markings={markings} orgId={orgId}
          onClose={() => { setCreating(false) }} />
      )}
    </section>
  )
}

function NewSessionDialog(
  { markings, orgId, onClose }: { markings: MarkingPick[]; orgId: string | null; onClose: () => void },
) {
  const create = useCreateScopedSession(orgId)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [query, setQuery] = useState('')
  const [picked, setPicked] = useState<string[]>([])

  const hits = markings.filter((m) =>
    `${m.category} ${m.name}`.toLowerCase().includes(query.trim().toLowerCase()))
  // Grouped under the category, which is how the dialog lists them.
  const groups = [...new Set(hits.map((m) => m.category))].sort()

  return (
    <Dialog isOpen title="New scoped session" onClose={onClose}>
      <DialogBody>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold flex items-center gap-1">
            Name
            <Icon icon="help" size={11} className="text-muted-foreground"
              title="Shown to people choosing a session." />
          </span>
          <InputGroup value={name} onValueChange={setName} />
        </label>
        <label className="flex flex-col gap-1 mt-3">
          <span className="text-xs font-semibold">
            Description <span className="text-muted-foreground font-normal">(optional)</span>
          </span>
          <TextArea value={description} fill rows={2}
            onChange={(e) => { setDescription(e.currentTarget.value) }} />
        </label>

        <div className="mt-3 space-y-1">
          <span className="text-xs font-semibold">Marking</span>
          <InputGroup leftIcon="search" placeholder="Search for markings…"
            value={query} onValueChange={setQuery} />
          <div className="oma-marking-list">
            {groups.map((g) => (
              <div key={g}>
                <div className="oma-marking-group">{g || 'Uncategorized'}</div>
                {hits.filter((m) => m.category === g).map((m) => (
                  <label key={m.id}
                    className={picked.includes(m.id) ? 'oma-marking-row is-picked' : 'oma-marking-row'}>
                    <Checkbox checked={picked.includes(m.id)} className="mb-0"
                      onChange={() => {
                        setPicked(picked.includes(m.id)
                          ? picked.filter((x) => x !== m.id) : [...picked, m.id])
                      }} />
                    <span className="flex-1">
                      <Tag minimal icon="shield">{m.name}</Tag>
                    </span>
                  </label>
                ))}
              </div>
            ))}
            {hits.length === 0 && (
              <p className="text-xs text-muted-foreground p-2">No markings match.</p>
            )}
          </div>
        </div>

        {/* The dialog's own footer note, verbatim, because it is the thing an
            admin gets wrong: a session is a filter, never a grant. */}
        <Callout intent={Intent.NONE} className="!text-xs mt-3">
          People will only have access to these markings in this scoped session. Scoped sessions
          do not grant people membership to any markings.
        </Callout>
      </DialogBody>
      <DialogFooter actions={
        <>
          <Button variant="minimal" onClick={onClose}>Cancel</Button>
          <Button intent={Intent.PRIMARY} disabled={!name.trim()} loading={create.isPending}
            onClick={() => {
              create.mutate({ name: name.trim(), description: description.trim(), markingIds: picked },
                { onSuccess: onClose })
            }}>Create scoped session</Button>
        </>
      } />
    </Dialog>
  )
}
