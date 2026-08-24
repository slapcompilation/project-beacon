// The Action types page: what the ontology holds, what a builder stages, and
// what the form asks for before an action runs.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

interface Chain extends PromiseLike<{ data: unknown[]; error: null }> {
  select: () => Chain; order: () => Chain; is: () => Chain; eq: () => Chain
}

const db = vi.hoisted(() => {
  const rule = (kind: string) => ({
    id: `r-${kind}`, kind, position: 0, object_type_id: 'ot1',
    link_type_id: null, function_name: null, action_type_rule_properties: [],
  })
  const rows: Record<string, unknown[]> = {
    ontologies: [{
      id: 'ont1', rid: null, api_name: 'production', label: 'Production Ontology',
      description: '', space_id: 'sp1', spaces: { name: 'Production', path: '/Production' },
    }],
    object_types: [{
      id: 'ot1', ontology_id: 'ont1', api_name: 'Aircraft', label: 'Aircraft', icon: 'cube',
      description: '', rid: null, aliases: [],
      object_type_properties: [{
        id: 'p1', property_id: 'tail', display_name: 'Tail', api_name: 'tail', description: '',
        base_type: 'string', source: 'column', datasource_id: null, backing_column: 'tail',
        shared_property_id: null, required: true, visibility: 'normal', position: 0,
        is_primary_key: true, is_title_key: true,
      }],
      version: 1,
      status: 'experimental', visibility: 'normal', deprecation_reason: null,
      deprecation_deadline: null, replaced_by: null, created_by_user_id: null,
      created_at: '', updated_at: '',
    }],
    action_types: [{
      id: 'at1', ontology_id: 'ont1', api_name: 'ground-aircraft', label: 'Ground aircraft',
      description: '', status: 'experimental', created_at: '', automate_can_submit: true,
      action_type_rules: [rule('modify_object')],
      action_type_parameters: [{
        id: 'pa1', api_name: 'reason', display_name: 'Reason', description: '',
        base_type: 'string', object_type_id: null,
        required: true, exposed: true, editable: true, position: 0,
      }],
    }],
    // A None over a group membership: the shape the page calls a
    // misconfiguration, so the editor has to render it before anyone can fix it.
    action_type_submission_criteria: [
      { id: 'c1', action_type_id: 'at1', parent_id: null, position: 0, node_type: 'logical',
        logical_operator: 'none', template: null, parameter_id: null, user_field: null,
        attribute_name: null, operator: null, value_source: null, value_parameter_id: null,
        static_value: null, failure_message: 'You may not be an auditor' },
      { id: 'c2', action_type_id: 'at1', parent_id: 'c1', position: 0, node_type: 'condition',
        logical_operator: null, template: 'current_user', parameter_id: null,
        user_field: 'group_ids', attribute_name: null, operator: 'includes',
        value_source: 'static', value_parameter_id: null, static_value: 'auditors',
        failure_message: null },
    ],
  }
  return { rows, staged: [] as unknown[], canEdit: true }
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

// The rule vocabulary comes from the database, so the picker's contents are it.
vi.mock('@/lib/supabase/ontologyClient', () => ({
  client: (entity: { apiName: string }) => ({
    executeFunction: () => Promise.resolve(
      entity.apiName === 'action_rule_kinds'
        ? ['create_object', 'modify_object', 'delete_object', 'create_link', 'function']
            .map((kind) => ({ kind, targets: 'object_type',
              executable: !['create_link', 'function'].includes(kind), note: `note for ${kind}` }))
        : entity.apiName === 'submission_operators'
          ? [{ operator: 'is', arity: 'single', note: '' },
             { operator: 'includes', arity: 'multi', note: '' }]
          : entity.apiName === 'can_write_action_type'
            ? db.canEdit
            : [],
    ),
    applyAction: (args: unknown) => {
      if (entity.apiName === 'save_action_type') { db.staged.push(args); return Promise.resolve('at2') }
      if (entity.apiName === 'apply_action') return Promise.resolve(1)
      return Promise.resolve({ status: 'success', object_count: 2, error: null })
    },
  }),
}))

import ActionTypesPage from './ActionTypesPage'

afterEach(() => { cleanup(); db.staged.length = 0; db.canEdit = true })

const renderPage = () => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter><ActionTypesPage /></MemoryRouter>
  </QueryClientProvider>,
)

describe('Action types', () => {
  it('lists an action with what its rules do', async () => {
    renderPage()
    expect(await screen.findByText('Ground aircraft')).toBeDefined()
    expect(screen.getByText('ground-aircraft')).toBeDefined()
    expect(screen.getByText('modify Aircraft')).toBeDefined()
    expect(screen.getByText('1 param')).toBeDefined()
  })

  it('stages the whole action — label, api name, parameter and rule', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.type(await screen.findByPlaceholderText(/^Label/), 'Ground aircraft')
    await user.type(screen.getByPlaceholderText('Display name'), 'Reason')
    const target = await screen.findByRole('option', { name: 'Aircraft' })
    await user.selectOptions(target.closest('select') as HTMLSelectElement, 'ot1')
    await user.click(screen.getByRole('button', { name: /Create action type/ }))

    expect(db.staged).toHaveLength(1)
    const { p_action: a } = db.staged[0] as { p_action: Record<string, unknown> }
    expect(a.api_name).toBe('ground-aircraft')
    expect(a.parameters).toEqual([expect.objectContaining({ api_name: 'reason', required: true })])
    expect(a.rules).toEqual([expect.objectContaining({ kind: 'create_object', object_type_id: 'ot1' })])
  })

  it('refuses the four kinds apply_action cannot run, in the picker', async () => {
    renderPage()
    expect((await screen.findByRole('option', { name: 'create link' })).hasAttribute('disabled')).toBe(true)
    expect(screen.getByRole('option', { name: 'modify object' }).hasAttribute('disabled')).toBe(false)
  })

  it('draws the criteria tree under the tab the course names', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('button', { name: 'Security & Submission Criteria' }))
    expect(await screen.findByText('Security & Submission Criteria')).toBeDefined()
    expect(screen.getByText('Execution')).toBeDefined()
    // the root's operator word is a control, and only the root takes a message
    expect((screen.getByRole('option', { name: 'None' }).closest('select') as HTMLSelectElement).value)
      .toBe('none')
    expect(screen.getByDisplayValue('You may not be an auditor')).toBeDefined()
    // "+ Add a condition or a logical operator" at both levels: root and inside the None
    expect(screen.getAllByRole('button', { name: 'condition' })).toHaveLength(2)
  })

  it('says criteria are hidden rather than showing none, to a non-editor', async () => {
    db.canEdit = false
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('button', { name: 'Security & Submission Criteria' }))
    expect(await screen.findByText(/hidden from users who cannot edit/)).toBeDefined()
    // the tree itself is not drawn, and neither is the invitation to add to it
    expect(screen.queryByRole('option', { name: 'None' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'condition' })).toBeNull()
  })

  // The second card on the tab: "Allow Foundry Automate to submit this action".
  it('offers the Frontend consumers switch beside the criteria', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('button', { name: 'Security & Submission Criteria' }))
    expect(await screen.findByText('Frontend consumers')).toBeDefined()
    expect(screen.getByText('Allow Foundry Automate to submit this action')).toBeDefined()
  })

  it('filters the operator list by arity, which is what a group list needs', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('button', { name: 'Security & Submission Criteria' }))
    const verb = (await screen.findByRole('option', { name: 'includes' })).closest('select')
    expect(verb).not.toBeNull()
    // a membership is many values, so the five single-value operators are absent
    expect(screen.queryByRole('option', { name: 'is' })).toBeNull()
  })

  it('asks the form for the exposed parameters, and for a target when a rule modifies', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('button', { name: 'Apply' }))
    expect(await screen.findByText(/Reason/)).toBeDefined()
    expect(screen.getByText(/Target primary key/)).toBeDefined()
    expect(screen.getByPlaceholderText('The object this action edits')).toBeDefined()
  })
})
