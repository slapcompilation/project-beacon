// The Check access panel — "sometimes referred to as the 'Access checker'"
// (security/checking-permissions.md). Pick a user; the database answers per
// clause in the page's two halves: Access requirements (organization,
// markings, "Having one or more roles (directly, via a group, or a default
// role)") and Additional data requirements (markings inherited through
// lineage). The colored dot per row is the screenshots' idiom.

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, HTMLSelect, Icon, Spinner, SpinnerSize } from '@blueprintjs/core'
import { client } from '@/lib/supabase/ontologyClient'
import { checkAccess } from '@beacon/platform'
import { useOrgMembers } from '@/features/projects/api'

interface Clause { section: string; requirement: string; detail: string; satisfied: boolean }

function useCheckAccess(kind: string, id: string, userId: string | null) {
  return useQuery({
    queryKey: ['check-access', kind, id, userId],
    enabled: !!userId,
    queryFn: async (): Promise<Clause[]> =>
      client(checkAccess).executeFunction({ p_kind: kind, p_id: id, p_user: userId as string }),
    retry: false,
    staleTime: 15_000,
  })
}

function ClauseRow({ c }: { c: Clause }) {
  return (
    <li className="flex items-start gap-2 px-3 py-1.5 text-xs">
      <Icon icon="full-circle" size={8}
        className={c.satisfied ? 'text-success mt-1' : 'text-red-600 mt-1'} />
      <span className="flex-1">
        {c.requirement}
        {c.detail && <span className="block text-[11px] text-muted-foreground">{c.detail}</span>}
      </span>
    </li>
  )
}

export function CheckAccessPanel({ kind, resourceId }: { kind: 'project' | 'dataset' | 'restricted_view'; resourceId: string }) {
  const { data: people = [] } = useOrgMembers()
  const [userId, setUserId] = useState('')
  const { data: clauses, isLoading, error } = useCheckAccess(kind, resourceId, userId || null)

  const access = (clauses ?? []).filter((c) => c.section === 'access')
  const data = (clauses ?? []).filter((c) => c.section === 'data')

  return (
    <Card compact className="!p-0">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <Icon icon="shield" size={12} className="text-muted-foreground" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Check access</span>
        <HTMLSelect minimal value={userId} onChange={(e) => { setUserId(e.currentTarget.value) }}>
          <option value="">Check a user…</option>
          {people.map((p) => <option key={p.id} value={p.id}>{p.email}</option>)}
        </HTMLSelect>
        {isLoading && <Spinner size={SpinnerSize.SMALL} />}
      </div>

      {error !== null && (
        <p className="px-3 py-2 text-xs text-muted-foreground">{error.message}</p>
      )}
      {clauses && (
        <>
          <p className="px-3 pt-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Access requirements
          </p>
          <ul className="divide-y divide-border/30">
            {access.map((c) => <ClauseRow key={c.requirement} c={c} />)}
          </ul>
          {data.length > 0 && (
            <>
              <p className="px-3 pt-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Additional data requirements
              </p>
              <ul className="divide-y divide-border/30">
                {data.map((c) => <ClauseRow key={c.requirement} c={c} />)}
              </ul>
            </>
          )}
        </>
      )}
    </Card>
  )
}
