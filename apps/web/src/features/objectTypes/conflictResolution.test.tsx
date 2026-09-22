// The Conflict resolution control on the Datasources tab.
//
// "Users can configure this option in the Ontology Manager, under the
// Datasources section" (object-edits/how-edits-applied) — the control the census
// recorded as missing, and the one the engine in 842 answers to.
//
// Two things are worth pinning. The option that needs a timestamp property must
// be unreachable when there is none, because the database refuses it by name
// and an offered control that always errors is worse than an absent one. And
// the row must not appear on a media set view, which receives no user edits.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ObjectTypeDef } from '@beacon/ontology'

interface Chain extends PromiseLike<{ data: unknown; error: null }> {
  select: () => Chain
  eq: () => Chain
  order: () => Chain
  in: () => Chain
  single: () => Chain
  maybeSingle: () => Chain
  update: () => Chain
  insert: () => Chain
  delete: () => Chain
}

const db = vi.hoisted(() => ({ rows: {} as Record<string, unknown> }))

vi.mock('@/lib/supabase/client', () => {
  const make = (table: string): Chain => {
    const p = Promise.resolve({ data: table in db.rows ? db.rows[table] : [], error: null })
    const chain: Chain = {
      select: () => chain, eq: () => chain, order: () => chain, in: () => chain,
      single: () => chain, maybeSingle: () => chain,
      update: () => chain, insert: () => chain, delete: () => chain,
      then: p.then.bind(p),
    }
    return chain
  }
  return { supabase: { from: make, rpc: () => Promise.resolve({ data: [], error: null }) } }
})

import { DatasourcesTab } from './TypeConfigTabs'

const source = (over: Record<string, unknown> = {}) => ({
  id: 'ds1', dataset_id: 'd1', branch_id: 'b1', restricted_view_id: null,
  media_set_view_rid: null, primary_key_column: null,
  allowed_markings: null, allowed_organizations: null,
  conflict_resolution: 'apply_user_edits', timestamp_property_id: null,
  datasets: { name: 'tickets' }, dataset_branches: { name: 'master' }, restricted_views: null,
  ...over,
})

const typeWith = (properties: unknown[]) => ({
  id: 't1', apiName: 'Ticket', ontologyId: 'o1', properties,
} as unknown as ObjectTypeDef)

const KEY = { id: 'p0', key: 'ticket_id', label: 'Ticket ID', type: 'string', isPrimaryKey: true, datasourceId: null }
const STAMP = { id: 'p1', key: 'ts', label: 'Latest Build TS', type: 'timestamp', datasourceId: 'ds1' }
const DATE_ONLY = { id: 'p2', key: 'due', label: 'Due', type: 'date', datasourceId: 'ds1' }

const show = async (type: ObjectTypeDef) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={qc}>
      <DatasourcesTab type={type} />
    </QueryClientProvider>,
  )
  await screen.findByText('Conflict resolution strategy')
}

afterEach(() => { cleanup(); db.rows = {} })

describe('the Conflict resolution control', () => {
  it('offers both strategies and marks the published default', async () => {
    db.rows = { object_type_datasources: [source()] }
    await show(typeWith([KEY, STAMP]))
    expect(screen.getByRole('button', { name: 'Apply user edits' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Apply most recent value' })).toBeTruthy()
    // "Apply user edits (default)" — the page's own parenthesis, and the
    // capture renders it as a tag beside the option.
    expect(screen.getByText('Default')).toBeTruthy()
  })

  // "The `Apply most recent value` option requires that the datasource contains
  // a property with the timestamp type; the date property type will not work
  // for this option."
  it('disables the conditional strategy when no timestamp property exists', async () => {
    db.rows = { object_type_datasources: [source()] }
    await show(typeWith([KEY, DATE_ONLY]))
    const btn = screen.getByRole('button', { name: 'Apply most recent value' })
    expect(btn.hasAttribute('disabled') || btn.getAttribute('aria-disabled') === 'true').toBe(true)
  })

  it('enables it once the datasource has a timestamp property', async () => {
    db.rows = { object_type_datasources: [source()] }
    await show(typeWith([KEY, STAMP]))
    const btn = screen.getByRole('button', { name: 'Apply most recent value' })
    expect(btn.hasAttribute('disabled') || btn.getAttribute('aria-disabled') === 'true').toBe(false)
  })

  // The timestamp row is the second line of the capture, and it only means
  // anything under the conditional strategy.
  it('shows the timestamp property only under the conditional strategy', async () => {
    db.rows = {
      object_type_datasources: [source({
        conflict_resolution: 'apply_most_recent_value', timestamp_property_id: 'p1',
      })],
    }
    await show(typeWith([KEY, STAMP]))
    expect(screen.getByText('Timestamp property')).toBeTruthy()
    expect(screen.getByText('Latest Build TS')).toBeTruthy()
  })

  it('hides the timestamp property under the default strategy', async () => {
    db.rows = { object_type_datasources: [source()] }
    await show(typeWith([KEY, STAMP]))
    expect(screen.queryByText('Timestamp property')).toBeNull()
  })

  // A media set view "backs media reference properties directly": no rows, no
  // user edits, nothing to resolve.
  it('does not offer the control on a media set view', async () => {
    db.rows = {
      object_type_datasources: [source({
        dataset_id: null, branch_id: null, media_set_view_rid: 'ri.mio.main.view.1', datasets: null,
      })],
    }
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={qc}>
        <DatasourcesTab type={typeWith([KEY, STAMP])} />
      </QueryClientProvider>,
    )
    await screen.findByText('ri.mio.main.view.1')
    expect(screen.queryByText('Conflict resolution strategy')).toBeNull()
  })
})
