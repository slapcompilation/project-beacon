// The Security tab's three requirement cards, and particularly the one 833 made
// answerable: "See instances".
//
// The page enumerates two mutually exclusive shapes for the last clause —
// policies govern visibility independently of the datasource, OR the datasource
// permissions govern it — so the card is wrong if it ever shows both or neither.
// That is what these tests pin, because the engine behind it refuses nothing on
// today's data and a silent regression here would look like a working screen.

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
}

const db = vi.hoisted(() => ({ rows: {} as Record<string, unknown> }))

vi.mock('@/lib/supabase/client', () => {
  const make = (table: string): Chain => {
    // `in`, not `??`: maybeSingle()/single() answer data: null when no row
    // exists, and `??` would collapse that to [] and hide the no-policy state.
    const p = Promise.resolve({
      data: table in db.rows ? db.rows[table] : [], error: null,
    })
    const chain: Chain = {
      select: () => chain, eq: () => chain, order: () => chain, in: () => chain,
      single: () => chain, maybeSingle: () => chain,
      then: p.then.bind(p),
    }
    return chain
  }
  return { supabase: { from: make, rpc: () => Promise.resolve({ data: [], error: null }) } }
})

import { SecurityTab } from './TypeConfigTabs'

const type = { id: 't1', apiName: 'Aircraft', ontologyId: 'o1' } as unknown as ObjectTypeDef

const base = () => ({
  object_types: { project_id: 'p1', protected: false, projects: { name: 'Flight Ops' } },
  ontologies: { spaces: { name: 'S', space_organizations: [{ organizations: { name: 'Acme' } }] } },
  resource_markings: [],
  object_type_datasources: [{ id: 'd1', allowed_organizations: null, datasets: { name: 'aircraft' }, restricted_views: null }],
  object_security_policies: null,
  property_security_policies: [],
})

const draw = async () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<QueryClientProvider client={qc}><SecurityTab type={type} /></QueryClientProvider>)
  expect(await screen.findByText('See instances')).toBeTruthy()
}

afterEach(() => { cleanup(); db.rows = {} })

describe('the Security tab explains what it enforces', () => {
  it('names all three requirement cards the page enumerates', async () => {
    db.rows = base()
    await draw()
    expect(screen.getByText('View object type')).toBeTruthy()
    expect(screen.getByText('Edit object type')).toBeTruthy()
    // Run actions is deliberately absent — it reasons over action types.
    expect(screen.queryByText('Run actions')).toBeNull()
  })

  it('falls to the datasource requirement when no policy is configured', async () => {
    db.rows = base()
    await draw()
    expect(screen.getByText('Data source policies · Any of')).toBeTruthy()
    expect(screen.getByText('View permissions on aircraft')).toBeTruthy()
    expect(screen.queryByText('Object and property security policies')).toBeNull()
  })

  it('switches to the policy requirement once an object policy exists', async () => {
    db.rows = { ...base(), object_security_policies: { id: 'osp', name: 'p', policy: null } }
    await draw()
    expect(screen.getByText('Object and property security policies')).toBeTruthy()
    // The exemption is the whole point: the datasource clause must GO, not sit
    // beside it. "users do not need Viewer permissions to the object type's
    // backing data sources to view object instances."
    expect(screen.queryByText('Data source policies · Any of')).toBeNull()
  })

  it('switches on a property policy too, which carries the same exemption', async () => {
    db.rows = {
      ...base(),
      property_security_policies: [{ id: 'psp', name: 'p', policy: null, property_security_policy_properties: [] }],
    }
    await draw()
    expect(screen.getByText('Object and property security policies')).toBeTruthy()
    expect(screen.queryByText('Data source policies · Any of')).toBeNull()
  })

  it('says so rather than going blank when nothing backs the type', async () => {
    db.rows = { ...base(), object_type_datasources: [] }
    await draw()
    expect(screen.getByText('No backing datasource')).toBeTruthy()
  })
})
