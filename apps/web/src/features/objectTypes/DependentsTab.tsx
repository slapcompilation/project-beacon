// Section 5 of Foundry's object type Overview — Dependents.
//
// The shape is `oma-user-interface-overview-annotated.png`: two panes, kinds
// with counts on the left and the instances of the selected kind on the right.
// Three details the prose never gives, all read off that image:
//
//   * the header count is the SUM of the kinds (9+2+1+1+1 = 14), so a dependent
//     is counted once per instance and not once per reference;
//   * the ZEROES ARE RENDERED — the kind list is shown whole, which is what
//     makes it a directory rather than a result set;
//   * the right pane offers Create new, so it is a place of work.
//
// Ours lists two kinds where Foundry lists nine, and that is not a gap:
// `curating-apps` scopes the application list per enrollment ("as well as in
// the rest of Foundry"), so the zeroes are kinds the platform HAS.

import { useState } from 'react'
import { Callout, Icon, NonIdealState, Spinner, Tag } from '@blueprintjs/core'
import type { IconName } from '@blueprintjs/icons'
import type { ObjectTypeDef } from '@beacon/ontology'
import { useDependentCounts, useDependents } from './dependentsAndUsage'

const KIND_ICON: Record<string, IconName> = {
  function: 'function',
  automation: 'automatic-updates',
}

export function DependentsTab({ type }: { type: ObjectTypeDef }) {
  const counts = useDependentCounts(type.id)
  const list = useDependents(type.id)
  const [kind, setKind] = useState<string | null>(null)

  if (counts.isLoading) return <Spinner size={20} />
  const rows = counts.data ?? []
  const total = rows.reduce((n, r) => n + r.dependents, 0)
  // Default to the first kind that has any, so the right pane opens on
  // something — exactly as the screenshot opens on Workshop 9.
  const active = kind ?? rows.find((r) => r.dependents > 0)?.kind ?? rows.at(0)?.kind ?? null
  const instances = (list.data ?? []).filter((d) => d.kind === active)

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold">Dependents</h3>
        <Tag minimal round className="tabular-nums">{total}</Tag>
      </div>

      <div className="grid grid-cols-[220px_1fr] gap-3">
        <ul className="divide-y divide-border/60 rounded border border-border">
          {rows.map((r) => (
            <li key={r.kind}>
              <button
                type="button"
                onClick={() => { setKind(r.kind) }}
                className={`flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs
                  ${active === r.kind ? 'bg-violet-50 font-semibold' : ''}`}
              >
                <Icon icon={KIND_ICON[r.kind] ?? 'cube'} size={12} />
                <span className="flex-1">{r.label}</span>
                {/* The zeroes are rendered — that is the point of the panel. */}
                <Tag minimal className="tabular-nums">{r.dependents}</Tag>
              </button>
            </li>
          ))}
        </ul>

        <div className="rounded border border-border">
          {list.isLoading
            ? <div className="p-3"><Spinner size={16} /></div>
            : instances.length === 0
              ? <NonIdealState
                  icon="clean"
                  title="Nothing depends on this"
                  description={`No ${rows.find((r) => r.kind === active)?.label.toLowerCase() ?? 'resource'} reads this object type.`}
                  className="!py-6 [&_.bp6-non-ideal-state-visual]:!text-2xl"
                />
              : <ul className="divide-y divide-border/60">
                  {instances.map((d) => (
                    <li key={d.dependent_id} className="flex items-center gap-2 px-2 py-1.5 text-xs">
                      <Icon icon={KIND_ICON[d.kind] ?? 'cube'} size={12} />
                      <span>{d.name}</span>
                    </li>
                  ))}
                </ul>}
        </div>
      </div>

      <Callout intent="none" icon="info-sign" className="!text-xs">
        A dependent is an <strong>application</strong> that consumes this object
        type. Action types and link types are not dependents — Foundry gives them
        their own sections, and folding them in would inflate every count while
        answering a question this panel does not ask. A dependent you cannot see
        is not counted.
      </Callout>
    </div>
  )
}
