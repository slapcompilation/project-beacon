// Which scoped session the person is in, and the way to change it. Personal, so
// it sits on Account rather than Settings — the presets themselves are authored
// in Platform Settings.
//
// Hidden entirely when the org has scoped sessions off, because "scoped sessions
// are disabled by default" and a control for a disabled feature is noise.
import { useState } from 'react'
import { Button, Card, Tag } from '@blueprintjs/core'
import { useAuthStore } from '@/stores/auth.store'
import { ChooseScopedSessionDialog } from '@/features/security/ChooseScopedSessionDialog'
import { useActiveSession, useSelectableSessions, useSessionSettings } from '@/features/security/scopedSessions'

export function ActiveSessionSection() {
  const orgId = useAuthStore((s) => s.organizationId)
  const { data: settings } = useSessionSettings(orgId)
  const { data: sessions = [] } = useSelectableSessions()
  const { data: active } = useActiveSession()
  const [choosing, setChoosing] = useState(false)

  if (!settings?.enabled) return null
  const current = sessions.find((s) => s.id === active) ?? null

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold">Scoped session</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          A session narrows what you see to a focus of work. It never grants a marking, and
          resources with no markings stay visible either way.
        </p>
      </div>
      <Card compact className="flex items-center gap-2 text-xs">
        {current
          ? <Tag icon="shield">{current.name}</Tag>
          : <span className="text-muted-foreground">No session — you see everything you are a member of.</span>}
        <Button size="small" className="ml-auto" onClick={() => { setChoosing(true) }}>
          {current ? 'Change' : 'Choose scoped session'}
        </Button>
      </Card>
      {choosing && <ChooseScopedSessionDialog onClose={() => { setChoosing(false) }} />}
    </section>
  )
}
