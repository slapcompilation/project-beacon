// Ontology Manager's chrome: the sidebar counts what this ontology holds, a
// Discover card links to the type it names, and the header search finds a type
// by the things its placeholder promises — name, RID, aliases.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

interface Chain extends PromiseLike<{ data: unknown[]; error: null }> {
  select: () => Chain; order: () => Chain; is: () => Chain; eq: () => Chain
}

const db = vi.hoisted(() => {
  const type = (id: string, label: string, description: string, aliases: string[]) => ({
    id, ontology_id: 'ont1', api_name: label, label, icon: 'cube', description,
    rid: `ri.ontology.main.object-type.${id}`, aliases,
    object_type_properties: [], computed_properties: null, view_config: null,
    enabled: true, version: 1, status: 'experimental', visibility: 'normal',
    deprecation_reason: null, deprecation_deadline: null, replaced_by: null,
    created_by_user_id: null, created_at: '', updated_at: '',
  })
  const rows: Record<string, unknown[]> = {
    ontologies: [{
      id: 'ont1', rid: 'ri.ontology.main.ontology.1', api_name: 'production', label: 'Production Ontology',
      description: '', space_id: 'sp1', spaces: { name: 'Production', path: '/Production' },
    }],
    object_types: [type('ot1', 'Aircraft', 'Every airframe in the fleet', ['Plane']), type('ot2', 'Flight', '', [])],
    shared_properties: [{ id: 'sp1', ontology_id: 'ont1', api_name: 'cost', label: 'Cost', description: '', base_type: 'number', visibility: 'normal' }],
    link_types: [{ id: 'lt1', ontology_id: 'ont1', source_object_type_id: 'ot1', target_object_type_id: 'ot2', api_name: 'flies', label: 'Flies' }],
    action_types: [{
      id: 'at1', ontology_id: 'ont1', api_name: 'ground-aircraft', label: 'Ground aircraft',
      description: '', status: 'experimental', created_at: '',
      action_type_rules: [], action_type_parameters: [],
    }],
    ontology_interfaces: [{ id: 'if1', ontology_id: 'ont1', rid: null, api_name: 'Roomed', label: 'Roomed', description: '', interface_properties: [] }],
    object_type_indexes: [{ object_type_id: 'ot1', status: 'success', error: null, object_count: 12, indexed_at: '' }],
  }
  return { rows }
})

vi.mock('@/lib/supabase/client', () => {
  const make = (table: string): Chain => {
    const p = Promise.resolve({ data: db.rows[table] ?? [], error: null })
    const chain: Chain = {
      select: () => chain, order: () => chain, is: () => chain, eq: () => chain,
      then: p.then.bind(p),
    }
    return chain
  }
  return { supabase: { from: make } }
})
// The working state is empty, so the header's save area renders nothing.
vi.mock('@/lib/supabase/ontologyClient', () => ({
  client: () => ({ executeFunction: () => Promise.resolve([]), applyAction: () => Promise.resolve(null) }),
}))

import OmaLayout from './OmaLayout'
import DiscoverPage from '@/pages/ontology/DiscoverPage'
import ObjectTypesPage from '@/pages/ontology/ObjectTypesPage'
import SharedPropertiesPage from '@/pages/ontology/SharedPropertiesPage'
import LinkTypesPage from '@/pages/ontology/LinkTypesPage'
import ActionTypesPage from '@/pages/ontology/ActionTypesPage'
import InterfacesPage from '@/pages/ontology/InterfacesPage'
import { useAuthStore } from '@/stores/auth.store'

const ONTOLOGIES = db.rows.ontologies
afterEach(() => { cleanup(); db.rows.ontologies = ONTOLOGIES })

const renderOma = (at = '/ontology') => {
  useAuthStore.setState({ role: 'owner' })
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[at]}>
        <Routes>
          <Route path="/ontology" element={<OmaLayout />}>
            <Route index element={<DiscoverPage />} />
            <Route path="object-types" element={<ObjectTypesPage />} />
            <Route path="shared-properties" element={<SharedPropertiesPage />} />
            <Route path="link-types" element={<LinkTypesPage />} />
            <Route path="action-types" element={<ActionTypesPage />} />
            <Route path="interfaces" element={<InterfacesPage />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('Ontology Manager chrome', () => {
  it('counts this ontology in the sidebar, under its switcher', async () => {
    renderOma()
    expect(await screen.findByRole('button', { name: /Ontology: Production Ontology/ })).toBeDefined()
    for (const [label, count] of [['Object types', '2'], ['Shared Properties', '1'], ['Link types', '1'], ['Action types', '1'], ['Interfaces', '1']]) {
      const row = await screen.findByRole('link', { name: new RegExp(`^${label}`) })
      expect(within(row).getByText(count)).toBeDefined()
    }
  })

  it('lands on Discover, whose cards link to the type they name', async () => {
    renderOma()
    const card = await screen.findByRole('link', { name: /Aircraft/ })
    expect(card.getAttribute('href')).toBe('/ontology/object-types?type=ot1')
    // The index count is the moment a type goes live; an unindexed one says so.
    expect(await within(card).findByText('12 objects')).toBeDefined()
    expect(within(await screen.findByRole('link', { name: /Flight/ })).getByText('No description')).toBeDefined()
  })

  // Every resource page renders inside the chrome, with the ontology's own rows.
  it.each([
    ['/ontology/object-types', 'Object types', 'Aircraft'],
    ['/ontology/shared-properties', 'Shared Properties', 'Cost'],
    ['/ontology/link-types', 'Link types', 'Flies'],
    ['/ontology/action-types', 'Action types', 'Ground aircraft'],
    ['/ontology/interfaces', 'Interfaces', 'Roomed'],
  ])('%s renders its resources', async (path, title, row) => {
    renderOma(path)
    expect(await screen.findByRole('heading', { name: title })).toBeDefined()
    expect(await screen.findAllByText(row)).not.toHaveLength(0)
  })

  // A new enrollment has no ontology, and nothing below can be authored without
  // one — so Discover is the callout, under the chrome rather than instead of it.
  it('asks for an ontology when there is none', async () => {
    db.rows.ontologies = []
    renderOma()
    expect(await screen.findByText('No ontology yet')).toBeDefined()
    expect(screen.getByText('Ontology Manager')).toBeDefined()
  })

  it('finds a type from the header by an alias, not just its name', async () => {
    const user = userEvent.setup()
    renderOma()
    await user.click(await screen.findByRole('button', { name: /Search by name, RID, aliases/ }))
    await user.type(await screen.findByRole('textbox', { name: 'Search Ontology resources' }), 'plane')
    const hits = await screen.findAllByRole('menuitem')
    expect(hits).toHaveLength(1)
    expect(hits[0].textContent).toContain('Aircraft')
  })
})
