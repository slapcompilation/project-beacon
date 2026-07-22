// Process Mining (P11) — Foundry Machinery for hospitality. Pick a process
// (restock / PO / case / proposal), see its mined state machine with per-state
// and per-transition metrics, and catch bottlenecks where objects pile up.

import { useState } from 'react'
import { Icon, SegmentedControl, Spinner, SpinnerSize, HTMLTable, Tag, Intent } from '@blueprintjs/core'
import type { LifecycleNode } from '@beacon/reality-graph'
import { useActiveHotelId } from '@/hooks/useActiveHotelId'
import { useMinedProcess } from '@/features/processMining/hooks'
import { ProcessExplorer } from '@/features/processMining/ProcessExplorer'
import { isBottleneck, formatDuration } from '@/features/processMining/analysis'

const PROCESSES: { id: LifecycleNode; label: string }[] = [
  { id: 'restock_request', label: 'Restock Requests' },
  { id: 'purchase_order',  label: 'Purchase Orders' },
  { id: 'case',            label: 'Cases' },
  { id: 'proposal',        label: 'Proposals' },
]

export default function ProcessMiningPage() {
  const hotelId = useActiveHotelId()
  const [nodeType, setNodeType] = useState<LifecycleNode>('restock_request')
  const { data, isLoading } = useMinedProcess(nodeType, hotelId)

  const process = data ?? { states: [], transitions: [] }
  const bottlenecks = process.states.filter((s) => isBottleneck(nodeType, s))

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-8 py-5 flex-shrink-0">
        <h1 className="text-xl font-semibold">Process Mining</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Mined from the lifecycle transition log — how objects flow through their states, where they pile up.
        </p>
        <div className="mt-3">
          <SegmentedControl
            options={PROCESSES.map((p) => ({ label: p.label, value: p.id }))}
            value={nodeType}
            onValueChange={(v) => { setNodeType(v as LifecycleNode) }}
            size="small"
          />
        </div>
      </div>

      <div className="flex-1 overflow-auto px-8 py-6 space-y-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
            <Spinner size={SpinnerSize.SMALL} /> Mining…
          </div>
        ) : (
          <>
            {bottlenecks.length > 0 && (
              <div className="flex items-start gap-2 rounded border border-amber-400/50 bg-amber-50/60 px-4 py-3 text-sm dark:bg-amber-950/20">
                <Icon icon="warning-sign" className="mt-0.5 text-amber-600" />
                <div>
                  <span className="font-medium">
                    {bottlenecks.length === 1 ? '1 bottleneck' : `${String(bottlenecks.length)} bottlenecks`} detected.
                  </span>{' '}
                  <span className="text-muted-foreground">
                    {bottlenecks.map((b) => b.state.replace(/_/g, ' ')).join(', ')} — far more objects entered than exited.
                  </span>
                </div>
              </div>
            )}

            <ProcessExplorer nodeType={nodeType} data={process} />

            {process.states.length > 0 && (
              <div className="grid gap-6 lg:grid-cols-2">
                <section>
                  <h2 className="mb-2 text-sm font-semibold">States</h2>
                  <HTMLTable compact striped className="w-full text-sm">
                    <thead>
                      <tr>
                        <th>State</th>
                        <th className="text-right">In state</th>
                        <th className="text-right">Entered</th>
                        <th className="text-right">Exited</th>
                        <th className="text-right">Ø duration</th>
                      </tr>
                    </thead>
                    <tbody>
                      {process.states.map((s) => (
                        <tr key={s.state}>
                          <td className="capitalize">
                            {s.state.replace(/_/g, ' ')}
                            {isBottleneck(nodeType, s) && (
                              <Tag intent={Intent.WARNING} minimal className="ml-2">bottleneck</Tag>
                            )}
                          </td>
                          <td className="text-right tabular-nums">{s.current_count}</td>
                          <td className="text-right tabular-nums">{s.entered_count}</td>
                          <td className="text-right tabular-nums">{s.exited_count}</td>
                          <td className="text-right tabular-nums">{formatDuration(s.avg_duration_s)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </HTMLTable>
                </section>

                <section>
                  <h2 className="mb-2 text-sm font-semibold">Transitions</h2>
                  {process.transitions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No transitions recorded yet — only the current state of each object. Moves are logged as statuses change.
                    </p>
                  ) : (
                    <HTMLTable compact striped className="w-full text-sm">
                      <thead>
                        <tr>
                          <th>Transition</th>
                          <th className="text-right">Count</th>
                          <th className="text-right">Ø lead time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {process.transitions.map((t) => (
                          <tr key={`${t.from}->${t.to}`}>
                            <td className="capitalize">{t.from.replace(/_/g, ' ')} → {t.to.replace(/_/g, ' ')}</td>
                            <td className="text-right tabular-nums">{t.count}</td>
                            <td className="text-right tabular-nums">{formatDuration(t.avg_lead_time_s)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </HTMLTable>
                  )}
                </section>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
