// The Automate application: the status vocabulary the filter pane enumerates,
// and the two of five we deliberately cannot answer.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

interface Chain extends PromiseLike<{ data: unknown[]; error: null }> {
  select: () => Chain; order: () => Chain; limit: () => Chain; eq: () => Chain
}

const db = vi.hoisted(() => {
  const automation = (id: string, name: string, over: Record<string, unknown> = {}) => ({
    id, display_name: name, description: '', owner_id: 'u1', scope: 'project',
    paused: false, last_run_at: null, created_at: '2026-08-01T00:00:00Z',
    condition: { type: 'time', cron: '0 9 * * *', timezone: 'UTC' },
    automation_effects: [], ...over,
  })
  const rows: Record<string, unknown[]> = {
    automations: [
      automation('a1', 'Good morning email'),
      automation('a2', 'Nightly reconcile', { paused: true }),
      automation('a3', 'Escalate breaches', {
        condition: { type: 'objects_added', object_set_id: 'os1' },
        automation_effects: [{
          id: 'e1', kind: 'action', action_type_id: 'at1', function_id: null,
          retry_count: 3, retry_interval: '00:05:00', fallback_for: null,
        }],
      }),
    ],
    // a3's most recent run failed, which is what makes it Error
    automation_runs: [
      { id: 'r1', automation_id: 'a3', effect_id: 'e1', outcome: 'failed',
        error: 'Actions:ObjectVersionChanged', ran_at: '2026-08-20T10:00:00Z',
        attempt: 1, next_attempt_at: null },
    ],
  }
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
      { kind: 'action', runtime: 'sql', executable: true, note: 'Execute actions on objects.' },
      { kind: 'notification', runtime: 'none', executable: false,
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

  it('shows all five statuses and disables the two with no column behind them', async () => {
    const user = userEvent.setup()
    renderAt('/automate')
    await user.click(await screen.findByRole('button', { name: 'Automations' }))

    for (const label of ['Active', 'Error', 'Muted', 'Paused', 'Expired']) {
      expect(screen.getByLabelText(label, { exact: false })).toBeDefined()
    }
    const off = (label: string) =>
      screen.getByLabelText(label, { exact: false }).hasAttribute('disabled')
    expect(off('Muted')).toBe(true)
    expect(off('Expired')).toBe(true)
    expect(off('Active')).toBe(false)
    expect(off('Paused')).toBe(false)
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
  })

  it('says the History tab shows runs, not the event log', async () => {
    const user = userEvent.setup()
    renderAt('/automate/a3')
    await user.click(await screen.findByRole('button', { name: /History/ }))
    expect(screen.getByText(/The event log .* is not\s+built/s)).toBeDefined()
    expect(screen.getByText('failed')).toBeDefined()
  })

  it('draws Execute and Telemetry disabled rather than hiding them', async () => {
    renderAt('/automate/a1')
    const railOff = (name: RegExp) =>
      screen.getByRole('button', { name }).hasAttribute('disabled')
    expect(await screen.findByRole('button', { name: /Overview/ })).toBeDefined()
    expect(railOff(/Execute/)).toBe(true)
    expect(railOff(/Telemetry/)).toBe(true)
  })
})
