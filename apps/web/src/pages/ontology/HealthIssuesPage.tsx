// The Health issues list — `ontology-manager/health-issues`.
//
// The shape is `save-review-edits-error.png`, which is the only documented
// picture of how this product presents a problem: the object type carries an
// icon, a name and a red issue-count badge; under it a grey scope header
// (PROPERTIES); under that the subject; and under that the message in its own
// bordered row behind a red error dot. Those four levels are exactly the four
// columns `ontology_violations()` returns, which is not a coincidence — the
// function was shaped for this.
//
// Everything here is an ERROR. The save session already draws the line the docs
// draw — "errors need to be handled in order to save, warnings will not prevent
// you from saving" — and `save_working_state` refuses a save that INTRODUCES a
// violation, so every row on this page is save-blocking by construction. A
// Warnings tab needs a severity the linter does not carry yet; it is not faked
// here with an empty tab.

import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Callout, HTMLTable, Icon, NonIdealState, Spinner, Tag } from '@blueprintjs/core'
import { useViolations, type Violation } from '@/features/health/api'

/** Grouped the way the dialog draws it: type → scope → the rows. */
function group(rows: Violation[]) {
  const byType = new Map<string, Map<string, Violation[]>>()
  for (const r of rows) {
    const scopes = byType.get(r.object_type) ?? new Map<string, Violation[]>()
    scopes.set(r.scope, [...(scopes.get(r.scope) ?? []), r])
    byType.set(r.object_type, scopes)
  }
  return [...byType.entries()]
    // The dialog leads with the entry carrying the most issues.
    .sort((a, b) => count(b[1]) - count(a[1]))
}

const count = (scopes: Map<string, Violation[]>) =>
  [...scopes.values()].reduce((n, rows) => n + rows.length, 0)

export default function HealthIssuesPage() {
  const violations = useViolations()
  const grouped = useMemo(() => group(violations.data ?? []), [violations.data])

  if (violations.isLoading) return <Spinner size={20} />

  return (
    <section className="space-y-3 p-4">
      <header className="flex items-center gap-2">
        <h1 className="text-base font-semibold">Health issues</h1>
        <Tag minimal round intent={grouped.length > 0 ? 'danger' : 'none'} className="tabular-nums">
          {violations.data?.length ?? 0}
        </Tag>
      </header>

      <Callout intent="none" icon="info-sign" className="!text-xs">
        Health issues ask whether an object type is <strong>malformed</strong>, not
        whether it is still used — that is <Link to="/ontology/cleanup">Cleanup</Link>.
        Every issue here blocks a save that introduces it.
      </Callout>

      {grouped.length === 0
        ? <NonIdealState icon="tick-circle" title="No health issues"
            description="Every object type in this ontology is well-formed." />
        : grouped.map(([type, scopes]) => (
            <div key={type} className="rounded border">
              <div className="flex items-center gap-2 border-b px-3 py-2">
                <Icon icon="cube" size={13} className="text-violet-500" />
                <span className="text-xs font-semibold">{type}</span>
                <span className="flex-1" />
                <Tag minimal intent="danger" className="tabular-nums !text-[10px]">
                  {count(scopes)}
                </Tag>
              </div>
              {[...scopes.entries()].map(([scope, rows]) => (
                <div key={scope}>
                  <p className="bg-neutral-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                    {scope}
                  </p>
                  <HTMLTable compact className="w-full !text-xs">
                    <tbody>
                      {rows.map((r) => (
                        <tr key={`${r.subject}-${r.problem}`}>
                          <td className="w-6 align-top">
                            <Icon icon="error" size={12} intent="danger" />
                          </td>
                          <td className="w-64 align-top font-mono text-[11px] text-neutral-500">
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
    </section>
  )
}
