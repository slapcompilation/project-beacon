// The Security policies section, against the three states its captures show.
//
// What this is really guarding is that the two policy kinds stay distinguishable
// on the row: the page gives them different denial shapes — an object policy
// withholds the instance, a property policy nulls the value — and the list is
// where an operator tells them apart before clicking anything.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ObjectTypeDef } from '@beacon/ontology'

interface Chain extends PromiseLike<{ data: unknown; error: null }> {
  select: () => Chain
  eq: () => Chain
  order: () => Chain
  in: () => Chain
  maybeSingle: () => Chain
}

const db = vi.hoisted(() => ({
  rows: {} as Record<string, unknown>,
  markings: [] as string[],
  fields: [] as { name: string; type: string }[],
}))

vi.mock('@/lib/supabase/client', () => {
  const make = (table: string): Chain => {
    // `in`, not `??` — maybeSingle() returns data: null when no row exists,
    // and `??` would collapse that to [] and hide the no-policy state.
    const p = Promise.resolve({
      data: table in db.rows ? db.rows[table] : [], error: null,
    })
    const chain: Chain = {
      select: () => chain, eq: () => chain, order: () => chain, in: () => chain,
      maybeSingle: () => chain,
      then: p.then.bind(p),
    }
    return chain
  }
  return {
    supabase: {
      from: make,
      // object_policy_markings / property_policy_markings / datasource_markings
      // answer with marking ids; object_type_policy_fields answers with fields.
      rpc: (fn: string) => Promise.resolve({
        data: fn === 'object_type_policy_fields' ? db.fields : db.markings,
        error: null,
      }),
    },
  }
})

import { SecurityPoliciesCard } from './SecurityPoliciesCard'

afterEach(() => {
  cleanup()
  db.rows = {}
  db.markings = []
  db.fields = []
})

const type = {
  id: 'ot1', apiName: 'Passenger', label: 'Passenger', icon: 'cube',
  description: '', version: 1,
  properties: [
    { key: 'pk', label: 'User ID', apiName: 'userId', type: 'string', required: true, isPrimaryKey: true },
    { key: 'name', label: 'Name', apiName: 'name', type: 'string', required: false },
    { key: 'address', label: 'Address', apiName: 'address', type: 'string', required: false },
  ],
} as unknown as ObjectTypeDef

const show = () => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <SecurityPoliciesCard type={type} />
  </QueryClientProvider>,
)

describe('the Security policies section', () => {
  it('offers Create against each datasource while no object policy exists', async () => {
    db.rows = {
      object_type_datasources: [
        { id: 'ds1', allowed_organizations: ['o1', 'o2'], datasets: { name: 'passenger' }, restricted_views: null },
      ],
      object_security_policies: null,
      property_security_policies: [],
    }
    show()

    // The datasource's own policy, which Create overrides — "Select Create under
    // the Security policies section to override data source policies".
    expect(await screen.findByText('Datasource policy')).toBeTruthy()
    expect(screen.getByText('passenger')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Create' })).toBeTruthy()
    // Nothing to add a property policy to until the object policy exists, which
    // is the database's rule too (Policies:ObjectPolicyRequired).
    expect(screen.queryByText('Add property security policy')).toBeNull()
  })

  it('names the object policy after the datasource it overrode, and covers all properties', async () => {
    db.rows = {
      object_type_datasources: [
        { id: 'ds1', allowed_organizations: ['o1'], datasets: { name: 'passenger' }, restricted_views: null },
      ],
      object_security_policies: { id: 'osp1', name: 'passenger' },
      property_security_policies: [],
    }
    db.markings = ['m1', 'm2']
    show()

    expect(await screen.findByText('Object security policy')).toBeTruthy()
    expect(screen.getByText('All properties')).toBeTruthy()
    // The grey Datasource policy tag is gone: it was overridden, not added to.
    expect(screen.queryByText('Datasource policy')).toBeNull()
    expect(screen.getByText('Add property security policy')).toBeTruthy()
  })

  it('lists a property policy beneath it with its own name and property count', async () => {
    db.rows = {
      object_type_datasources: [
        { id: 'ds1', allowed_organizations: [], datasets: { name: 'passenger' }, restricted_views: null },
      ],
      object_security_policies: { id: 'osp1', name: 'passenger' },
      property_security_policies: [
        {
          id: 'psp1', name: 'hide PII properties',
          property_security_policy_properties: [
            { property_id: 'name' }, { property_id: 'address' }, { property_id: 'phone' },
          ],
        },
      ],
    }
    show()

    expect(await screen.findByText('Property security policy')).toBeTruthy()
    // A property policy's name is free text, not the datasource link.
    expect(screen.getByText('hide PII properties')).toBeTruthy()
    expect(screen.getByText('3 Properties')).toBeTruthy()
    // Both kinds are on screen at once and stay distinguishable.
    expect(screen.getByText('Object security policy')).toBeTruthy()
  })

  it('says so plainly when there is no datasource to override', async () => {
    db.rows = {
      object_type_datasources: [],
      object_security_policies: null,
      property_security_policies: [],
    }
    show()
    expect(await screen.findByText(/no backing datasource/)).toBeTruthy()
  })
})

describe('the Compose dialog', () => {
  const withObjectPolicy = (policy: unknown = null) => {
    db.rows = {
      object_type_datasources: [
        { id: 'ds1', allowed_organizations: ['o1'], datasets: { name: 'passenger' }, restricted_views: null },
      ],
      object_security_policies: { id: 'osp1', name: 'passenger', policy },
      property_security_policies: [],
    }
    db.fields = [
      { name: 'user_id', type: 'STRING' },
      { name: 'seats', type: 'LONG' },
    ]
  }

  it('lands on the Overview, not on a slot — the arrow is the point', async () => {
    withObjectPolicy()
    show()
    await userEvent.click(await screen.findByRole('button', { name: /Edit passenger/ }))

    // Both columns, which is what says a policy REPLACES the datasource's
    // requirements rather than adding to them.
    expect(await screen.findByText('Datasource access requirements')).toBeTruthy()
    expect(screen.getByText('Policy access requirements')).toBeTruthy()
    // The four policy-side slots.
    expect(screen.getByText('Granular policy')).toBeTruthy()
    expect(screen.getAllByText('Organizations').length).toBeGreaterThan(0)
    expect(screen.getAllByText('AND').length).toBeGreaterThan(0)
  })

  it('shows the granular arm as None until it has rules', async () => {
    withObjectPolicy()
    show()
    await userEvent.click(await screen.findByRole('button', { name: /Edit passenger/ }))
    expect(await screen.findByText('Granular policy')).toBeTruthy()
    expect(screen.getAllByText('None').length).toBeGreaterThan(0)
  })

  it('offers only the four comparisons an object policy allows', async () => {
    withObjectPolicy({
      match: 'all',
      rules: [{ left: { user_attribute: 'user_id' }, comparison: 'equal', right: { value: 'x' } }],
    })
    show()
    await userEvent.click(await screen.findByRole('button', { name: /Edit passenger/ }))
    await userEvent.click(await screen.findByRole('button', { name: 'Manage Granular policy' }))

    // "Object security policies do not support less/greater than comparison
    // operators." — so the four that remain, and none of the four that do not.
    expect(await screen.findByText('is equal to')).toBeTruthy()
    expect(screen.getByText('intersects')).toBeTruthy()
    expect(screen.queryByText('is less than')).toBeNull()
    expect(screen.queryByText('is greater than')).toBeNull()
  })

  it('does not offer a marking condition when no property can satisfy one', async () => {
    withObjectPolicy({
      match: 'all',
      rules: [{ left: { user_attribute: 'user_id' }, comparison: 'equal', right: { value: 'x' } }],
    })
    show()
    await userEvent.click(await screen.findByRole('button', { name: /Edit passenger/ }))
    await userEvent.click(await screen.findByRole('button', { name: 'Manage Granular policy' }))

    // Its only legal right-hand term is a MARKING property, and this type has
    // none — so the affordance would be a guaranteed save failure.
    expect(screen.queryByText('Add marking condition')).toBeNull()
    expect(await screen.findByText(/no mandatory control property/)).toBeTruthy()
  })

  it('offers a marking condition once a mandatory control property exists', async () => {
    withObjectPolicy({
      match: 'all',
      rules: [{ left: { user_attribute: 'user_id' }, comparison: 'equal', right: { value: 'x' } }],
    })
    db.fields = [...db.fields, { name: 'vip', type: 'MARKING' }]
    show()
    await userEvent.click(await screen.findByRole('button', { name: /Edit passenger/ }))
    await userEvent.click(await screen.findByRole('button', { name: 'Manage Granular policy' }))
    expect(await screen.findByText('Add marking condition')).toBeTruthy()
  })
})
