// The Automate application: the status vocabulary the filter pane enumerates,
// and the two of five we deliberately cannot answer.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

interface Chain extends PromiseLike<{ data: unknown[]; error: null }> {
  select: () => Chain; order: () => Chain; limit: () => Chain; eq: () => Chain
}

const db = vi.hoisted(() => {
  const automation = (id: string, name: string, over: Record<string, unknown> = {}) => ({
    id, display_name: name, description: '', owner_id: 'u1', scope: 'project',
    paused: false, muted: false, expires_at: null, execution: 'parallel',
    last_run_at: null, created_at: '2026-08-01T00:00:00Z',
    condition: { type: 'time', cron: '0 9 * * *', timezone: 'UTC' },
    automation_effects: [], ...over,
  })
  const rows: Record<string, unknown[]> = {
    automations: [
      automation('a1', 'Good morning email'),
      automation('a2', 'Nightly reconcile', { paused: true }),
      automation('a4', 'Quiet hours digest', { muted: true }),
      automation('a5', 'Old campaign',
        { expires_at: '2026-01-01T00:00:00Z', paused: true, muted: true }),
      automation('a3', 'Escalate breaches', {
        condition: { type: 'objects_added', object_set_id: 'os1' },
        execution: 'sequential',
        automation_effects: [
          { id: 'e1', position: 0, kind: 'action', action_type_id: 'at1', function_id: null,
            retry_count: 3, retry_interval: '00:05:00', fallback_for: null },
          { id: 'e2', position: 1, kind: 'notification', action_type_id: null, function_id: null,
            retry_count: null, retry_interval: null, fallback_for: null },
        ],
      }),
    ],
    // a3's most recent run failed, which is what makes it Error
    automation_runs: [
      { id: 'r1', automation_id: 'a3', effect_id: 'e1', outcome: 'failed',
        error: 'Actions:ObjectVersionChanged', ran_at: '2026-08-20T10:00:00Z',
        attempt: 1, next_attempt_at: null, event_id: 'ev1' },
    ],
    // 622: the event is the firing, the run is its effect half.
    automation_events: [
      { id: 'ev1', automation_id: 'a3', event_type: 'automation_triggered',
        occurred_at: '2026-08-20T10:00:00Z', detail: null },
      { id: 'ev2', automation_id: 'a3', event_type: 'evaluation_failed',
        occurred_at: '2026-08-20T11:00:00Z', detail: 'Ontology:ObjectSetNotFound' },
    ],
  }
  rows.action_types = [
    { id: 'at1', label: 'Ground aircraft', automate_can_submit: true,
      action_type_rules: [], action_type_parameters: [] },
    { id: 'at2', label: 'Sensitive purge', automate_can_submit: false,
      action_type_rules: [], action_type_parameters: [] },
  ]
  rows.object_sets = []
  rows.projects = [{ id: 'p1', name: 'Ops' }]
  rows.ontologies = [{ id: 'ont1', api_name: 'production', label: 'Production' }]
  return { rows }
})

vi.mock('@/lib/supabase/client', () => {
  const make = (table: string): Chain => {
    const p = Promise.resolve({ data: db.rows[table] ?? [], error: null })
    const chain: Chain = {
      select: () => chain, order: () => chain, limit: () => chain, eq: () => chain,
      then: p.then.bind(p),
    }
    return chain
  }
  return { supabase: { from: make } }
})

vi.mock('@/lib/supabase/ontologyClient', () => ({
  client: () => ({
    executeFunction: () => Promise.resolve([
      { kind: 'action', runtime: 'sql', executable: true, orderable: true,
        note: 'Execute actions on objects.' },
      { kind: 'notification', runtime: 'none', executable: false, orderable: false,
        note: 'No notification system exists here.' },
    ]),
  }),
}))

import AutomatePage from './AutomatePage'

afterEach(cleanup)

const renderAt = (path: string) => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/automate" element={<AutomatePage />} />
        <Route path="/automate/:id" element={<AutomatePage />} />
      </Routes>
    </MemoryRouter>
  </QueryClientProvider>,
)

describe('Automate', () => {
  it('counts what the Overview page counts, and omits the card it cannot answer', async () => {
    renderAt('/automate')
    expect(await screen.findByText('Create and manage automations')).toBeDefined()
    expect(screen.getByText('Owned by you')).toBeDefined()
    expect(screen.getByText('Paused')).toBeDefined()
    // "For you — You receive notifications": the notification effect is
    // executable=false, so the card would always read zero.
    expect(screen.queryByText('For you')).toBeNull()
    expect(screen.getByText('Failures in last 4 weeks')).toBeDefined()
    // async: the heading paints before the runs query resolves
    expect(await screen.findByText('Actions:ObjectVersionChanged')).toBeDefined()
  })

  // 609 gave muted and expires_at their columns, so all five of the filter
  // pane's statuses are answerable and none is disabled any more.
  it('answers all five of the statuses the filter pane enumerates', async () => {
    const user = userEvent.setup()
    renderAt('/automate')
    await user.click(await screen.findByRole('button', { name: 'Automations' }))

    const off = (label: string) =>
      screen.getByLabelText(label, { exact: false }).hasAttribute('disabled')
    for (const label of ['Active', 'Error', 'Muted', 'Paused', 'Expired']) {
      expect(screen.getByLabelText(label, { exact: false })).toBeDefined()
      expect(off(label)).toBe(false)
    }
  })

  // "Expired... continue to block all execution, including manual runs", so
  // expiry outranks pause; a muted automation still evaluates, so it ranks
  // below both. The order is what blocks what.
  it('ranks expired over paused over muted over error', async () => {
    const user = userEvent.setup()
    renderAt('/automate')
    await user.click(await screen.findByRole('button', { name: 'Automations' }))

    // 'Old campaign' is expired AND paused AND muted at once — which is the
    // only shape that can tell an ordering from a coincidence.
    await user.click(screen.getByLabelText('Muted', { exact: false }))
    expect(await screen.findByText('Quiet hours digest')).toBeDefined()
    expect(screen.queryByText('Old campaign')).toBeNull()

    await user.click(screen.getByLabelText('Muted', { exact: false }))
    await user.click(screen.getByLabelText('Paused', { exact: false }))
    expect(await screen.findByText('Nightly reconcile')).toBeDefined()
    expect(screen.queryByText('Old campaign')).toBeNull()

    await user.click(screen.getByLabelText('Paused', { exact: false }))
    await user.click(screen.getByLabelText('Expired', { exact: false }))
    expect(await screen.findByText('Old campaign')).toBeDefined()
    expect(screen.queryByText('Quiet hours digest')).toBeNull()
  })

  it('derives Error from the most recent run, not from a column', async () => {
    const user = userEvent.setup()
    renderAt('/automate')
    await user.click(await screen.findByRole('button', { name: 'Automations' }))

    // a3's latest run failed → Error; a2 is paused → Paused; a1 → Active, and
    // an Active time condition reads as prose rather than the word.
    expect(screen.getByText('Running on schedule')).toBeDefined()
    expect(screen.getAllByText('Error').length).toBeGreaterThan(1)
    expect(screen.getAllByText('Paused').length).toBeGreaterThan(0)
  })

  it('names the retry configuration that has been enforced and shown nowhere', async () => {
    renderAt('/automate/a3')
    expect(await screen.findByText('Escalate breaches')).toBeDefined()
    expect(screen.getByText(/Retries 3 times, every 00:05:00/)).toBeDefined()
    // NULL is the documented other choice: "run indefinitely"
    expect(screen.getByText(/Indefinitely/)).toBeDefined()
  })

  // "Action, logic, and function effects can be ordered sequentially." A
  // notification cannot, so under sequential it is marked rather than numbered.
  it('numbers the ordered effects and marks the one that cannot be', async () => {
    renderAt('/automate/a3')
    expect(await screen.findByText('sequential')).toBeDefined()
    expect(screen.getByText('1.')).toBeDefined()
    expect(screen.getByText('not ordered')).toBeDefined()
    // position 1 is the notification, which is not part of the sequence
    expect(screen.queryByText('2.')).toBeNull()
  })

  // Until 622 this test asserted the opposite — that the tab SAYS the event log
  // is not built. The engine now writes one, so the surface reads it; an
  // engine nothing reaches is this repository's dominant defect.
  it('shows the event log above the effect runs it explains', async () => {
    const user = userEvent.setup()
    renderAt('/automate/a3')
    await user.click(await screen.findByRole('button', { name: /History/ }))
    expect(screen.getByText('Event log')).toBeDefined()
    // Foundry's label, not our stored token.
    expect(screen.getByText('Automation triggered')).toBeDefined()
    expect(screen.getByText('Evaluation failed')).toBeDefined()
    // the failure detail is what "View failure details in the History tab" means
    expect(screen.getByText('Ontology:ObjectSetNotFound')).toBeDefined()
    // and the effect half is still there, under its own heading
    expect(screen.getByText('Effect runs')).toBeDefined()
    expect(screen.getByText('failed')).toBeDefined()
  })

  // The capture shows eight and is cut off; branching-automations enumerates
  // the whole picker as ten. Four are ours; the rest carry the reason they are
  // not offered rather than being hidden.
  it('offers all ten conditions and marks the six it cannot run', async () => {
    const user = userEvent.setup()
    renderAt('/automate')
    await user.click(await screen.findByRole('button', { name: /New automation/ }))
    expect(await screen.findByText('Add condition')).toBeDefined()
    // scoped to the dialog: the Automations table also renders a `Time` subtitle
    const wizard = within(screen.getByRole('dialog'))

    for (const label of ['Time', 'Objects added to set', 'Objects removed from set',
      'Objects modified in a set', 'Run on all objects', 'Metric changed',
      'Threshold crossed', 'Automation dependency', 'Time series', 'Stream']) {
      expect(wizard.getByText(label)).toBeDefined()
    }
    // exactly six are marked, and they are the six with no engine behind them
    expect(wizard.getAllByText('not offered')).toHaveLength(6)
  })

  // 613's rule, mirrored in the wizard so it refuses before the database does.
  it('refuses a cron whose minute is not a plain number', async () => {
    const user = userEvent.setup()
    renderAt('/automate')
    await user.click(await screen.findByRole('button', { name: /New automation/ }))
    const wizard = within(await screen.findByRole('dialog'))
    await user.click(wizard.getByText('Time'))
    await user.click(wizard.getByLabelText(/Use Cron expression/))

    const field = wizard.getByDisplayValue('0 9 * * *')
    await user.clear(field)
    await user.type(field, '*/5 * * * *')
    expect(screen.getByText(/fires at most once an hour/)).toBeDefined()
  })

  // Execute went live in 625. Telemetry is still drawn-but-disabled, because
  // hiding a rail entry would misdraw the application.
  it('draws Telemetry disabled rather than hiding it, and Execute is live', async () => {
    renderAt('/automate/a1')
    const railOff = (name: RegExp) =>
      screen.getByRole('button', { name }).hasAttribute('disabled')
    expect(await screen.findByRole('button', { name: /Overview/ })).toBeDefined()
    expect(railOff(/Execute/)).toBe(false)
    expect(railOff(/Telemetry/)).toBe(true)
  })

  it('the Execute pane queues a run and says what queuing means', async () => {
    const user = userEvent.setup()
    renderAt('/automate/a1')
    await user.click(await screen.findByRole('button', { name: /Execute/ }))
    expect(screen.getByRole('button', { name: /Run now/ })).toBeDefined()
    // The 45-minute ceiling is stated where it applies, not buried in a header.
    expect(screen.getByText(/45 minutes/)).toBeDefined()
  })
})
