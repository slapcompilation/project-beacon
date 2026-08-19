// Section 7 of Foundry's object type Overview, and the Usage tab behind its
// "See more" — `oma-user-interface-usage-tab.png`.
//
// The panel's four displays all aggregate one grain: Aggregate usage
// (Interactions / Reads / Writes / Active users), a per-application breakdown,
// and Last interaction. Every number here is derived, never stored.
//
// The one thing this surface must get right is the distinction `view-usage`
// warns about: with the Ontology metrics toggle off you see "No usage for the
// last 30 days" for everything. NO DATA IS NOT NO USAGE — reporting an
// unmetered ontology as unused is how a cleanup queue proposes deleting all of
// it. So the tab says which of the two it is looking at, and says it first.

import { Callout, HTMLTable, NonIdealState, Spinner, Tag } from '@blueprintjs/core'
import type { ObjectTypeDef } from '@beacon/ontology'
import { useMetricsState, useUsageSummary, useUsageByApplication } from './dependentsAndUsage'

const AGO = (iso: string | null) => {
  if (!iso) return '—'
  const hours = Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000)
  if (hours < 1) return 'under an hour ago'
  if (hours < 24) return `${String(hours)} hours ago`
  return `${String(Math.floor(hours / 24))} days ago`
}

export function UsageTab({ type }: { type: ObjectTypeDef }) {
  const metrics = useMetricsState(type.ontologyId ?? null)
  const on = metrics.data?.enabled ?? false
  const summary = useUsageSummary(type.id, on)
  const byApp = useUsageByApplication(type.id, on)

  if (metrics.isLoading) return <Spinner size={20} />

  // The distinction, before any number is shown.
  if (!on) {
    return (
      <NonIdealState
        icon="disable"
        title="Ontology metrics are off"
        description={
          <span className="text-xs">
            No reads or writes are being recorded for this ontology, so there is
            <strong> no usage data</strong> — which is not the same as no usage.
            An administrator turns metrics on for the whole ontology.
          </span>
        }
        className="!py-8"
      />
    )
  }

  const s = summary.data
  const apps = byApp.data ?? []

  return (
    <div className="space-y-3">
      {!(metrics.data?.covers30d ?? false) &&
        <Callout intent="warning" icon="time" className="!text-xs">
          Metrics were switched on less than 30 days ago, so this window is
          <strong> incomplete</strong>. Nothing below should be read as evidence
          that an object type is unused.
        </Callout>}

      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold">Aggregate usage</h3>
        <Tag minimal className="!text-[10px]">last 30 days</Tag>
      </div>

      {summary.isLoading
        ? <Spinner size={16} />
        : <div className="grid grid-cols-4 gap-2">
            {([
              ['Interactions', s?.interactions ?? 0],
              ['Reads', s?.reads ?? 0],
              ['Writes', s?.writes ?? 0],
              ['Active users', s?.active_users ?? 0],
            ] as const).map(([label, value]) => (
              <div key={label} className="rounded border border-neutral-200 px-2 py-1.5">
                <div className="text-[10px] uppercase tracking-wide text-neutral-500">{label}</div>
                <div className="text-base font-semibold tabular-nums">{value}</div>
              </div>
            ))}
          </div>}

      <div className="text-xs text-neutral-600">
        Last interaction: <strong>{AGO(s?.last_interaction ?? null)}</strong>
      </div>

      <h3 className="pt-1 text-sm font-semibold">
        Application type <Tag minimal round className="tabular-nums">{apps.length}</Tag>
      </h3>
      {apps.length === 0
        ? <div className="text-xs text-neutral-500">No application has read or written this object type in the window.</div>
        : <HTMLTable compact striped className="w-full !text-xs">
            <thead><tr><th>Application</th><th className="text-right">Reads</th><th className="text-right">Writes</th></tr></thead>
            <tbody>
              {apps.map((a) => (
                <tr key={a.application}>
                  <td>{a.application}</td>
                  <td className="text-right tabular-nums">{a.reads}</td>
                  <td className="text-right tabular-nums">{a.writes}</td>
                </tr>
              ))}
            </tbody>
          </HTMLTable>}

      <Callout intent="none" icon="info-sign" className="!text-xs">
        A read is one <strong>load request</strong>, not one object — many
        objects loaded at once count once. Ontology Manager&apos;s own traffic is
        excluded, so browsing this page does not make the type look busy.
      </Callout>
    </div>
  )
}
