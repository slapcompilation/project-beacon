// The Run-action dialog's function-backed branch: the named error the edge
// function returns must reach the user (invoke buries it on error.context),
// and the selection must reach the function through its object-reference
// parameter — "a `Demo Ticket` parameter of type Object reference".

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const edge = vi.hoisted(() => ({ bodies: [] as { parameters: Record<string, string> }[], fail: true }))

vi.mock('@/lib/supabase/client', () => {
  interface Chain extends PromiseLike<{ data: unknown[]; error: null }> {
    select: () => Chain; order: () => Chain; eq: () => Chain
    single: () => Promise<{ data: unknown; error: null }>
  }
  const make = (): Chain => {
    const p = Promise.resolve({ data: [], error: null })
    const chain: Chain = {
      select: () => chain, order: () => chain, eq: () => chain, then: p.then.bind(p),
      // the post-apply reindex reads its build job back
      single: () => Promise.resolve({ data: { state: 'COMPLETED', error: null }, error: null }),
    }
    return chain
  }
  return {
    supabase: {
      from: make,
      functions: {
        invoke: (name: string, opts: { body: { parameters: Record<string, string> } }) => {
          // the post-apply reindex fire-and-forgets 'search-index'; only the
          // apply door is under test
          if (name !== 'action-apply') return Promise.resolve({ data: null, error: null })
          edge.bodies.push(opts.body)
          if (edge.fail) {
            // What supabase-js actually hands back on a non-2xx: a generic
            // message, with the named body only on context.
            return Promise.resolve({
              data: null,
              error: Object.assign(new Error('Edge Function returned a non-2xx status code'), {
                context: new Response(
                  JSON.stringify({ error: 'Actions:UserFacingFunctionFailure', detail: 'Ticket is closed' }),
                  { status: 400 }),
              }),
            })
          }
          return Promise.resolve({ data: { written: 1, application_id: 'app1' }, error: null })
        },
      },
    },
  }
})

vi.mock('@/lib/supabase/ontologyClient', () => ({
  client: (entity: { apiName: string }) => ({
    executeFunction: () => Promise.resolve(
      entity.apiName === 'action_form_effective' ? { parameters: {}, sections: {} } : []),
    applyAction: () => Promise.resolve(1),
  }),
}))

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { RunActionDialog } from './ActionsMenu'
import type { ActionTypeRow } from '@/features/actionTypes/api'

const action: ActionTypeRow = {
  id: 'at9', ontology_id: 'ont1', api_name: 'close-ticket', label: 'Close ticket',
  description: '', status: 'experimental', created_at: '', automate_can_submit: true,
  action_type_rules: [{
    id: 'r9', kind: 'function', position: 0, object_type_id: null, link_type_id: null,
    function_name: 'closeTicket', function_version_id: 'fv1', auto_upgrade: false,
    source_parameter_id: null, target_parameter_id: null,
    action_type_rule_properties: [],
  }],
  action_type_parameters: [{
    id: 'pp1', api_name: 'ticket', display_name: 'Ticket', description: '',
    data_kind: 'object', base_type: null, object_type_id: 'ot1',
    required: true, exposed: true, editable: true, position: 0,
  }],
}

afterEach(() => { cleanup(); edge.bodies.length = 0; edge.fail = true })

const renderDialog = (targets: string[]) => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <RunActionDialog action={action} targets={targets} selectedRow={null}
      objectTypeId="ot1" onClose={() => {}} />
  </QueryClientProvider>,
)

describe('function-backed apply', () => {
  it('fills the object-reference parameter from the selection and sends it', async () => {
    const user = userEvent.setup()
    renderDialog(['T-1'])
    // the selection lands in the form, visibly, before anything is sent
    expect(await screen.findByDisplayValue('T-1')).toBeDefined()
    edge.fail = false
    await user.click(screen.getByRole('button', { name: /Apply/ }))
    expect(edge.bodies).toEqual([expect.objectContaining({ parameters: { ticket: 'T-1' } })])
  })

  it('surfaces the named error from the response body and keeps the dialog open', async () => {
    const user = userEvent.setup()
    renderDialog(['T-1'])
    await screen.findByDisplayValue('T-1')
    await user.click(screen.getByRole('button', { name: /Apply/ }))
    // the generic FunctionsHttpError message is NOT what the user sees
    expect(await screen.findByText(/Actions:UserFacingFunctionFailure — Ticket is closed/)).toBeDefined()
    expect(screen.queryByText(/non-2xx/)).toBeNull()
    // still open: the field is still there to fix
    expect(screen.getByDisplayValue('T-1')).toBeDefined()
  })

  it('applies once per selected object when more than one is selected', async () => {
    const user = userEvent.setup()
    edge.fail = false
    renderDialog(['T-1', 'T-2'])
    expect(await screen.findByText('Applies to 2 objects')).toBeDefined()
    await user.click(screen.getByRole('button', { name: /Apply/ }))
    expect(edge.bodies.map((b) => b.parameters.ticket)).toEqual(['T-1', 'T-2'])
  })
})
