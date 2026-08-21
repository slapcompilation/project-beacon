// "Choose scoped session", drawn as scoped_session_login_example.png draws it:
// a filter above a list of session names on the left, each with a chevron and
// the selected one filled; on the right the name, the description, a divider,
// then a Marking access block reading "In this scoped session, you will only
// have access to the following markings:" over shield pills; and one primary
// button in the footer.
//
// Leaving the session is offered only when the org allows it — the policy's
// WITH CHECK is the real gate, this only avoids offering a refusal.
import { useState } from 'react'
import { Button, Dialog, DialogBody, DialogFooter, Icon, InputGroup, Intent, Tag } from '@blueprintjs/core'
import { useAuthStore } from '@/stores/auth.store'
import { useAllMarkings } from '@/features/lineage/api'
import {
  useActiveSession, useChooseSession, useSelectableSessions, useSessionSettings,
} from '@/features/security/scopedSessions'

export function ChooseScopedSessionDialog({ onClose }: { onClose: () => void }) {
  const orgId = useAuthStore((s) => s.organizationId)
  const { data: settings } = useSessionSettings(orgId)
  const { data: sessions = [] } = useSelectableSessions()
  const { data: active } = useActiveSession()
  const { data: markings = [] } = useAllMarkings()
  const choose = useChooseSession()
  const [query, setQuery] = useState('')
  const [picked, setPicked] = useState<string | null>(active ?? null)

  const named = new Map(markings.map((m) => [m.id, m]))
  const hits = sessions.filter((s) => s.name.toLowerCase().includes(query.trim().toLowerCase()))
  const current = sessions.find((s) => s.id === picked) ?? null

  return (
    <Dialog isOpen title="Choose scoped session" onClose={onClose} className="oma-session-dialog">
      <DialogBody className="!p-0">
        <div className="oma-session-split">
          <div className="oma-session-list">
            <div className="p-2">
              <InputGroup leftIcon="search" placeholder="Filter scoped sessions…"
                value={query} onValueChange={setQuery} />
            </div>
            <div className="oma-session-label">Scoped sessions</div>
            {hits.map((s) => (
              <button key={s.id} type="button"
                className={s.id === picked ? 'oma-session-row is-selected' : 'oma-session-row'}
                onClick={() => { setPicked(s.id) }}>
                <span className="truncate">{s.name}</span>
                <Icon icon="chevron-right" size={12} />
              </button>
            ))}
            {hits.length === 0 && (
              <p className="text-xs text-muted-foreground p-2">
                {sessions.length === 0
                  ? 'No sessions you can choose — selecting one requires membership of every marking in it.'
                  : 'No sessions match.'}
              </p>
            )}
          </div>

          <div className="oma-session-detail">
            {current ? (
              <>
                <h3 className="text-sm font-semibold">{current.name}</h3>
                {current.description && (
                  <p className="text-xs text-muted-foreground mt-1">{current.description}</p>
                )}
                <div className="border-t my-3" />
                <h4 className="text-xs font-semibold">Marking access</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  In this scoped session, you will only have access to the following markings:
                </p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {current.markings.map((id) => (
                    <Tag key={id} icon="shield">
                      {named.get(id) ? `${named.get(id)?.category}: ${named.get(id)?.name}` : id}
                    </Tag>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">Select a session to see what it covers.</p>
            )}
          </div>
        </div>
      </DialogBody>
      <DialogFooter actions={
        <>
          {settings?.allowNoSession && (
            <Button variant="minimal" loading={choose.isPending}
              onClick={() => { choose.mutate(null, { onSuccess: onClose }) }}>
              Continue without one
            </Button>
          )}
          <Button intent={Intent.PRIMARY} disabled={picked === null} loading={choose.isPending}
            onClick={() => { choose.mutate(picked, { onSuccess: onClose }) }}>
            Choose scoped session
          </Button>
        </>
      } />
    </Dialog>
  )
}
