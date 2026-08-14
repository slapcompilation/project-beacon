// Apply a function-backed action: run the edit function, then apply its batch.
//
// This is the door the isolate cannot open for itself.
//
//   "The only way to update objects using a function is by configuring an
//    action to use the function"                    (functions/edits-overview)
//   "running an edit function outside of an Action will not actually modify
//    any object data"
//
// It is also the split Foundry draws: "The Actions service is responsible for
// applying user edits to object databases" (object-backend/overview), with
// Functions on Objects a separate service beside it. `apply_action` is SQL and
// cannot execute TypeScript, so a function rule is applied here and the write
// still happens in one database call — "all edits are applied atomically at
// the end of the action call".
//
// Everything runs as the CALLER: reading the action, running the function's
// reads, and writing the edits.

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { runFunction } from '../_shared/isolate.ts'
import { ontologyReader } from '../_shared/ontology.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
}
const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json' } })

interface Rule {
  action_type_id: string
  ontology_id: string
  api_name: string
  version: string
  source: string
  signature: { parameters: { name: string; type: string; required: boolean }[]; returns: string }
  object_types: string[]
  edits: string[]
  /** input name → the action parameter that supplies it. */
  inputs: Record<string, string>
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })

  const auth = req.headers.get('authorization') ?? ''
  if (!auth.startsWith('Bearer ')) return reply(401, { error: 'sign in first' })

  const { actionTypeId, parameters = {} } =
    await req.json() as { actionTypeId?: string; parameters?: Record<string, unknown> }
  if (!actionTypeId) return reply(400, { error: 'actionTypeId is required' })

  const caller = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: auth } },
  })

  const { data, error } = await caller.rpc('action_function_to_run', { p_action_type: actionTypeId })
  if (error) return reply(400, { error: error.message })
  const rule = data as Rule | null
  if (rule === null) {
    return reply(404, { error: 'Actions:NotFunctionBacked — this action has no function rule' })
  }

  // "Configure the inputs to match up to the action parameters" — the mapping
  // is stored per input, so the function never sees a parameter name.
  const args: unknown[] = []
  for (const p of rule.signature.parameters) {
    const parameterName = rule.inputs[p.name]
    const value = parameterName === undefined ? undefined : parameters[parameterName]
    if (p.required && (value === undefined || value === null)) {
      return reply(400, {
        error: `Actions:InvalidParameter — ${parameterName ?? p.name} is required by ${rule.api_name}`,
      })
    }
    args.push(value ?? null)
  }

  const out = await runFunction(
    rule.source, args, [...rule.object_types, ...rule.edits],
    ontologyReader(caller, rule.ontology_id, new Set(rule.object_types)),
  )

  // The two failures the docs say exist only for function-backed actions:
  // "Function failure: The action failed because the underlying function
  // failed" and "User-facing function failure: The function backing the action
  // threw an error intended to be displayed to the user."
  if (out.kind === 'timeout') return reply(504, { error: 'Actions:FunctionFailure — 60 seconds' })
  if (out.kind === 'unsettled') return reply(504, { error: 'Actions:FunctionFailure — the function never returned' })
  if (out.kind === 'execution') {
    return reply(400, { error: 'Actions:UserFacingFunctionFailure', detail: out.error })
  }
  if (out.kind !== 'ok') {
    return reply(500, { error: 'Actions:FunctionFailure', detail: out.error })
  }

  // "The entire function must succeed in order to generate the list of edits
  // which is passed to the actions service executing the atomic transaction."
  const applied = await caller.rpc('apply_function_edits', {
    p_action_type: actionTypeId, p_edits: out.value,
  })
  if (applied.error) return reply(400, { error: applied.error.message })

  return reply(200, { edits: applied.data, version: rule.version })
})
