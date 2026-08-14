// Execute a published query function — the host half of the isolate.
//
// Every ontology read the guest makes is performed by the host with the
// CALLER's JWT, so RLS decides what the code sees — "the permissions of the
// end user running the function determine which objects are loaded"
// (functions/permissions).
//
// Queries "cannot have any side effects" (query-functions): the host answers
// three read operations and nothing else, and only for object types the
// published version declared as imports.
//
// An EDIT function is not run here. "running an edit function outside of an
// Action will not actually modify any object data" (functions/edits-overview),
// so its home is `action-apply`, which hands the batch to the action.

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

interface Payload {
  api_name: string
  source: string
  signature: { parameters: { name: string; type: string; required: boolean }[]; returns: string }
  object_types: string[]
  version: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })

  const auth = req.headers.get('authorization') ?? ''
  if (!auth.startsWith('Bearer ')) return reply(401, { error: 'sign in first' })

  const { ontologyId, apiName, inputs = {} } =
    await req.json() as { ontologyId?: string; apiName?: string; inputs?: Record<string, unknown> }
  if (!ontologyId || !apiName) return reply(400, { error: 'ontologyId and apiName are required' })

  // Everything below runs as the caller: the artifact read, and every
  // ontology call the guest makes.
  const caller = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: auth } },
  })

  const { data, error } = await caller.rpc('function_to_run', {
    p_ontology: ontologyId, p_api_name: apiName,
  })
  if (error) return reply(400, { error: error.message })
  const fn = data as Payload | null
  if (fn === null) return reply(404, { error: `${apiName} has no published version` })

  // Required inputs are the signature's, checked before the isolate starts.
  for (const p of fn.signature.parameters) {
    if (p.required && inputs[p.name] === undefined) {
      return reply(400, { error: `Functions:MissingInput — ${p.name} is required` })
    }
  }
  // Positional, in signature order — the documented TypeScript v2 shape is
  // `export default function f(client, first, second)`.
  const args = fn.signature.parameters.map((p) => inputs[p.name] ?? null)

  const out = await runFunction(
    fn.source, args, fn.object_types,
    ontologyReader(caller, ontologyId, new Set(fn.object_types)),
  )

  if (out.kind === 'timeout') return reply(504, { error: 'Functions:TimeLimitExceeded — 60 seconds' })
  if (out.kind === 'unsettled') return reply(504, { error: 'Functions:DidNotSettle — the function never returned' })
  if (out.kind === 'source') return reply(400, { error: 'Functions:SourceFailed', detail: out.error })
  if (out.kind === 'isolate') return reply(500, { error: 'Functions:IsolateFailed', detail: out.error })
  if (out.kind === 'execution') return reply(400, { error: 'Functions:ExecutionFailed', detail: out.error })
  return reply(200, { value: out.value, version: fn.version })
})
