// Execute a published function — the host half of the isolate.
//
// "This logic is executed on the server side in an isolated environment"
// (functions/overview). The isolate is QuickJS compiled to WebAssembly: the
// guest has linear memory and no ambient anything, and reaches the platform
// only through `__hostCall`, the one function injected below. Every ontology
// read that call performs is made with the CALLER's JWT, so RLS decides what
// the code sees — "the permissions of the end user running the function
// determine which objects are loaded" (functions/permissions).
//
// Queries "cannot have any side effects" (query-functions): the host answers
// three read operations and nothing else, and only for object types the
// published version declared as imports.

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { newQuickJSAsyncWASMModule, RELEASE_ASYNC } from 'npm:quickjs-emscripten@0.31.0'
import { GUEST_HARNESS } from './guest.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''

// Foundry's budget, bounded by what this substrate actually gives us.
//
// Foundry: "Functions are limited to **60 seconds** of elapsed run time by
// default" and serverless functions get 1024 MiB. Our runtime is smaller and
// the numbers are not negotiable (substrate-reference/mirror/functions/limits):
//   "Maximum Memory: 256MB" — for the whole worker, host included
//   "Maximum CPU Time: 2s ... does not include async I/O"
//   "Request idle timeout: 150s"
//
// So the isolate gets a fraction of the worker's memory, leaving room for the
// host and the WASM engine itself; the wall-clock deadline stays under the
// idle timeout so a hung function returns our error rather than a gateway
// 504. The 2-second CPU ceiling is the platform's and cannot be raised —
// compute-heavy guest code dies there no matter what we set, which is
// recorded in the reading rather than papered over.
const TIME_LIMIT_MS = 60_000
const MEMORY_LIMIT = 128 * 1024 * 1024

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

  const declared = new Set(fn.object_types)

  // One mediated ontology read. Reads only, and only what was imported.
  const mediate = async (op: string, payload: Record<string, unknown>) => {
    const objectType = String(payload.objectType ?? '')
    if (!declared.has(objectType)) {
      return { ok: false, error: `Functions:UndeclaredImport — ${objectType} is not imported by this function` }
    }
    // The v2 filter shape — { prop: value } or { prop: { $gt: n } } — onto
    // the documented exploration grammar (generate-urls.md).
    const filters: unknown[] = []
    for (const [property, raw] of Object.entries((payload.where ?? {}) as Record<string, unknown>)) {
      if (raw !== null && typeof raw === 'object') {
        const ops = raw as Record<string, unknown>
        const range: Record<string, unknown> = {}
        if ('$gt' in ops || '$gte' in ops) range.min = ops.$gt ?? ops.$gte
        if ('$lt' in ops || '$lte' in ops) range.max = ops.$lt ?? ops.$lte
        if ('$eq' in ops) {
          filters.push({ type: 'propertyFilter', propertyType: property,
            value: { type: 'valuesFilter', values: [String(ops.$eq)] } })
        } else {
          filters.push({ type: 'propertyFilter', propertyType: property,
            value: { type: 'numberRangeFilter', ...range } })
        }
      } else {
        filters.push({ type: 'propertyFilter', propertyType: property,
          value: { type: 'valuesFilter', values: [String(raw)] } })
      }
    }

    if (op === 'count') {
      const r = await caller.rpc('count_object_set_by_api_name',
        { p_ontology: ontologyId, p_api_name: objectType, p_filters: filters })
      return r.error ? { ok: false, error: r.error.message } : { ok: true, value: r.data }
    }
    if (op === 'page' || op === 'fetchOne') {
      const r = await caller.rpc('evaluate_object_set_by_api_name', {
        p_ontology: ontologyId, p_api_name: objectType, p_filters: filters,
        p_limit: op === 'fetchOne' ? 1 : Number(payload.pageSize ?? 100),
      })
      if (r.error) return { ok: false, error: r.error.message }
      const rows = (r.data ?? []) as unknown[]
      return { ok: true, value: op === 'fetchOne' ? (rows[0] ?? null) : rows }
    }
    return { ok: false, error: `Functions:UnsupportedOperation — ${op}` }
  }

  const QuickJS = await newQuickJSAsyncWASMModule(RELEASE_ASYNC)
  const runtime = QuickJS.newRuntime()
  runtime.setMemoryLimit(MEMORY_LIMIT)
  const deadline = Date.now() + TIME_LIMIT_MS
  runtime.setInterruptHandler(() => Date.now() > deadline)

  const ctx = runtime.newContext()
  try {
    // The single capability the guest holds. Asyncified, so guest code can
    // read the ontology without the host handing it a thread or a socket.
    const host = ctx.newAsyncifiedFunction('__hostCall', async (raw) => {
      const { op, payload } = JSON.parse(ctx.getString(raw)) as
        { op: string; payload: Record<string, unknown> }
      const result = await mediate(op, payload)
      return ctx.newString(JSON.stringify(result))
    })
    host.consume((h) => { ctx.setProp(ctx.global, '__hostCall', h) })

    const harness = ctx.evalCode(GUEST_HARNESS)
    if (harness.error) {
      const e = ctx.dump(harness.error); harness.error.dispose()
      return reply(500, { error: 'Functions:HarnessFailed', detail: e })
    }
    harness.value.dispose()

    // The code bindings: "generate code bindings for every object and link
    // type that was loaded" from the repository's imports. Here that is one
    // global per declared type, so the author writes `client(Aircraft)` the
    // way the pages print it.
    const bindings = fn.object_types
      .map((t) => `globalThis[${JSON.stringify(t)}] = { apiName: ${JSON.stringify(t)} }`)
      .join(';\n')
    if (bindings) {
      const b = ctx.evalCode(bindings)
      if (b.error) { b.error.dispose() } else { b.value.dispose() }
    }

    // "The TypeScript function must be the default export of your file."
    // QuickJS evaluates a script, so the export binding is rewritten to the
    // harness's own — the authoring contract is unchanged for the author.
    const prepared = fn.source.replace(/export\s+default\s+/, 'globalThis.__default = ')
    const loaded = ctx.evalCode(prepared)
    if (loaded.error) {
      const e = ctx.dump(loaded.error); loaded.error.dispose()
      return reply(400, { error: 'Functions:SourceFailed', detail: e })
    }
    loaded.value.dispose()

    const argsJson = JSON.stringify(args).replace(/</g, '\u003c')
    const started = await ctx.evalCodeAsync(`__start(${argsJson})`)
    if (started.error) {
      const e = ctx.dump(started.error); started.error.dispose()
      return reply(400, { error: 'Functions:ExecutionFailed', detail: e })
    }
    started.value.dispose()

    // Drain the microtask queue: every ontology read already returned, so the
    // function's own promise settles here.
    runtime.executePendingJobs()

    const stateHandle = ctx.getProp(ctx.global, '__state')
    const state = ctx.dump(stateHandle) as { done: boolean; value: string | null; error: string | null }
    stateHandle.dispose()

    if (!state.done) {
      return reply(504, { error: 'Functions:DidNotSettle — the function never returned' })
    }
    if (state.error !== null) {
      return reply(400, { error: 'Functions:ExecutionFailed', detail: state.error })
    }
    return reply(200, { value: JSON.parse(state.value ?? 'null'), version: fn.version })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    // The interrupt handler surfaces here when the deadline passes.
    if (message.includes('interrupt')) {
      return reply(504, { error: 'Functions:TimeLimitExceeded — 60 seconds' })
    }
    return reply(500, { error: 'Functions:IsolateFailed', detail: message })
  } finally {
    ctx.dispose()
    runtime.dispose()
  }
})
