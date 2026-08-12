// Main branch updates — "Review new changes from your main branch and rebase
// your branch to stay up to date." Conflicts resolve per resource: "Use Main
// branch changes or Keep current branch changes."
//
// SCOPE, stated: the screenshot also lists "Other changes" — main's changes to
// resources the branch never touched. That needs a main-side schema changelog
// we do not keep; the conflicts (the changes that BLOCK the branch) are what
// renders here, and the empty state is the screenshot's own.

import { useMemo, useState } from 'react'
import { Button, Callout, Icon, Intent, NonIdealState, Tag } from '@blueprintjs/core'
import { NoOntologyCallout } from '@/features/ontologies/OntologyPicker'
import { SectionHead } from '@/features/ontologyManager/OmaLayout'
import { useOmaOntology } from '@/features/ontologyManager/resources'
import { useAppStore } from '@/stores/app.store'
import {
  useBranchConflicts, useRebaseBranch, type RebaseResolution,
} from '@/features/branching/api'

const KIND_LABEL: Record<string, string> = {
  object_type: 'Object type', link_type: 'Link type', shared_property: 'Shared property',
  interface: 'Interface', action_type: 'Action type', type_group: 'Type group',
}

const show = (v: unknown): string => {
  if (v === null || v === undefined) return '—'
  if (typeof v === 'string') return v
  return JSON.stringify(v)
}

export default function MainBranchUpdatesPage() {
  const { ontology, isLoading } = useOmaOntology()
  const branchId = useAppStore((s) => s.omaBranchId)
  const { data: conflicts = [] } = useBranchConflicts(branchId)
  const rebase = useRebaseBranch()
  const [choices, setChoices] = useState<Record<string, 'main' | 'branch'>>({})

  const groups = useMemo(() => {
    const m = new Map<string, typeof conflicts>()
    for (const c of conflicts) {
      const key = `${c.resource_kind}:${c.resource_id}`
      m.set(key, [...(m.get(key) ?? []), c])
    }
    return m
  }, [conflicts])
  const undecided = [...groups.keys()].filter((k) => !(k in choices))

  if (!ontology) {
    return <div className="oma-page max-w-2xl">{isLoading ? null : <NoOntologyCallout />}</div>
  }
  if (branchId === null) {
    return (
      <div className="oma-page">
        <NonIdealState icon="git-branch" title="Main branch updates lives on a branch"
          description="Switch to a branch in the header to review what main changed underneath it." />
      </div>
    )
  }

  const finish = () => {
    const resolutions: RebaseResolution[] = [...groups.keys()].map((k) => {
      const [kind, id] = k.split(':')
      return { resource_kind: kind, resource_id: id, choice: choices[k] }
    })
    rebase.mutate({ branchId, resolutions }, { onSuccess: () => { setChoices({}) } })
  }

  return (
    <div className="oma-page">
      <SectionHead title="Main branch updates" seeAll={
        <Button intent={Intent.PRIMARY} icon="refresh" disabled={conflicts.length > 0 && undecided.length > 0}
          loading={rebase.isPending}
          title={undecided.length > 0 ? 'Resolve all conflicts before finishing the rebase' : undefined}
          onClick={finish}>
          {conflicts.length > 0 ? 'Finish rebase and save' : 'Rebase branch'}
        </Button>
      } />
      <p className="text-sm text-muted-foreground max-w-2xl mb-4">
        Review new changes from your main branch and rebase your branch to stay up to date.
      </p>

      {conflicts.length === 0 ? (
        <NonIdealState icon="git-merge" title="Branch is up to date"
          description="There are no updates from the main branch or you do not have permissions to view them." />
      ) : (
        <div className="max-w-3xl space-y-3">
          <Callout intent={Intent.PRIMARY} icon="info-sign" className="!text-[11px]">
            The changes previously saved on the branch conflict with main. Resolve all conflicts
            before saving and finishing the rebase.
          </Callout>
          {[...groups.entries()].map(([key, fields]) => (
            <div key={key} className="rounded border px-3 py-2 space-y-1">
              <div className="flex items-center gap-2">
                <Icon icon="git-merge" size={12} className="text-violet-500" />
                <span className="text-xs font-semibold">
                  {KIND_LABEL[fields[0].resource_kind]} · {key.split(':')[1].slice(0, 8)}
                </span>
                <span className="ml-auto flex gap-1">
                  <Button size="small" variant={choices[key] === 'main' ? 'solid' : 'outlined'}
                    onClick={() => { setChoices({ ...choices, [key]: 'main' }) }}>
                    Use Main branch changes
                  </Button>
                  <Button size="small" variant={choices[key] === 'branch' ? 'solid' : 'outlined'}
                    onClick={() => { setChoices({ ...choices, [key]: 'branch' }) }}>
                    Keep current branch changes
                  </Button>
                </span>
              </div>
              {fields.map((c) => (
                <div key={c.field} className="flex items-center gap-2 pl-5 text-[11px]">
                  <span className="w-32 shrink-0 text-muted-foreground">{c.field}</span>
                  <Tag minimal className="!text-[10px]">main: {show(c.main_value)}</Tag>
                  <Tag minimal intent={Intent.PRIMARY} className="!text-[10px]">branch: {show(c.branch_value)}</Tag>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
