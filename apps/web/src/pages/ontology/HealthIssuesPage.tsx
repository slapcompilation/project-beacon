// The Health issues list — `ontology-manager/health-issues`.
//
// The shape is `save-review-edits-error.png` and `save-review-edits-warning.png`,
// the only documented pictures of how this product presents a problem: the
// object type carries an icon, a name and an issue-count badge; under it a grey
// scope header (PROPERTIES); under that the subject; and under that the message
// in its own bordered row behind a coloured dot. Those four levels are exactly
// the four columns the linter returns, which is not a coincidence.
//
// Two tabs, because the difference is behavioural rather than cosmetic:
// "errors need to be handled in order to save, warnings will not prevent you
// from saving". `save_working_state` consults only the blocking list.
//
// The label singularises — `Warning (1)` against `Errors (9)` — which the save
// session reading found holding across four screenshots.

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Callout, HTMLTable, Icon, NonIdealState, Spinner, Tab, Tabs, Tag } from '@blueprintjs/core'
import { useViolations, useWarnings, type Violation } from '@/features/health/api'

/** Grouped the way the dialog draws it: type → scope → the rows. */
function group(rows: Violation[]) {
  const byType = new Map<string, Map<string, Violation[]>>()
  for (const r of rows) {
    const scopes = byType.get(r.object_type) ?? new Map<string, Violation[]>()
    scopes.set(r.scope, [...(scopes.get(r.scope) ?? []), r])
    byType.set(r.object_type, scopes)
  }
  // The dialog leads with the entry carrying the most issues.
  return [...byType.entries()].sort((a, b) => count(b[1]) - count(a[1]))
}

const count = (scopes: Map<string, Violation[]>) =>
  [...scopes.values()].reduce((n, rows) => n + rows.length, 0)

/** `Error (1)` but `Errors (9)` — a real label rule, visible across four
 *  screenshots and never stated in prose. */
const label = (word: string, n: number) => `${word}${n === 1 ? '' : 's'} (${n})`

function IssueList({ rows, intent }: { rows: Violation[]; intent: 'danger' | 'warning' }) {
  const grouped = useMemo(() => group(rows), [rows])
  if (grouped.length === 0) {
    return <NonIdealState icon="tick-circle"
      title={intent === 'danger' ? 'No errors' : 'No warnings'}
      description={intent === 'danger'
        ? 'Every object type in this ontology is well-formed.'
        : 'Nothing here is discouraged.'} />
  }
  return (
    <div className="space-y-3">
      {grouped.map(([type, scopes]) => (
        <div key={type} className="rounded border">
          <div className="flex items-center gap-2 border-b px-3 py-2">
            <Icon icon="cube" size={13} className="text-violet-500" />
            <span className="text-xs font-semibold">{type}</span>
            <span className="flex-1" />
            <Tag minimal intent={intent} className="tabular-nums">{count(scopes)}</Tag>
          </div>
          {[...scopes.entries()].map(([scope, items]) => (
            <div key={scope}>
              <p className="bg-neutral-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                {scope}
              </p>
              <HTMLTable compact className="w-full !text-xs">
                <tbody>
                  {items.map((r) => (
                    <tr key={`${r.subject}-${r.problem}`}>
                      <td className="w-6 align-top">
                        <Icon size={12} intent={intent}
                          icon={intent === 'danger' ? 'error' : 'warning-sign'} />
                      </td>
                      <td className="w-56 align-top font-mono text-xs text-neutral-500">
                        {r.subject}
                      </td>
                      <td>{r.problem}</td>
                    </tr>
                  ))}
                </tbody>
              </HTMLTable>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

export default function HealthIssuesPage() {
  const violations = useViolations()
  const warnings = useWarnings()
  const [tab, setTab] = useState<string>('errors')

  if (violations.isLoading) return <Spinner size={20} />
  const errors = violations.data ?? []
  const warns = warnings.data ?? []

  return (
    <section className="space-y-3 p-4">
      <header className="flex items-center gap-2">
        <h1 className="text-base font-semibold">Health issues</h1>
        <Tag minimal round intent={errors.length > 0 ? 'danger' : 'none'} className="tabular-nums">
          {errors.length + warns.length}
        </Tag>
      </header>

      <Callout intent="none" icon="info-sign" className="!text-xs">
        Health issues ask whether an object type is <strong>malformed</strong>, not
        whether it is still used — that is <Link to="/ontology/cleanup">Cleanup</Link>.
        An error blocks a save that introduces it; a warning never does.
      </Callout>

      <Tabs selectedTabId={tab} onChange={(id) => { setTab(String(id)) }} animate={false}>
        <Tab id="errors" icon="error" title={label('Error', errors.length)}
          panel={<IssueList rows={errors} intent="danger" />} />
        <Tab id="warnings" icon="warning-sign" title={label('Warning', warns.length)}
          panel={<IssueList rows={warns} intent="warning" />} />
      </Tabs>
    </section>
  )
}
