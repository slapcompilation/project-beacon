// The isolate, shared by every runtime that executes a published function.
//
// "This logic is executed on the server side in an isolated environment"
// (functions/overview). The isolate is QuickJS compiled to WebAssembly: the
// guest has linear memory and no ambient anything, and reaches the platform
// only through `__hostCall`, the one function injected below.
//
// Two callers: `function-run`, which returns whatever a query function
// computed, and `action-apply`, which hands an edit function's batch to the
// action. Both need exactly this and nothing more, so it lives here rather
// than twice.

import { newQuickJSAsyncWASMModule, RELEASE_ASYNC } from 'npm:quickjs-emscripten@0.31.0'
import { GUEST_HARNESS } from './guest.ts'

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
// idle timeout so a hung function returns our error rather than a gateway 504.
const TIME_LIMIT_MS = 60_000
const MEMORY_LIMIT = 128 * 1024 * 1024

/** One mediated call out of the guest. Reads only — the host performs them. */
export type Mediator = (op: string, payload: Record<string, unknown>) =>
  Promise<{ ok: boolean; value?: unknown; error?: string }>

export interface RunOutcome {
  /** `error` is null when the function settled with a value. */
  value: unknown
  error: string | null
  /** Which of our named failures this was, when it failed. */
  kind: 'ok' | 'source' | 'execution' | 'userFacing' | 'timeout' | 'isolate' | 'unsettled'
}

/**
 * Evaluate one published function and return what it settled with.
 *
 * `bindings` become globals the author writes by name — the page's own "code
 * bindings for every object and link type that was loaded".
 */
export async function runFunction(
  source: string,
  args: unknown[],
  bindings: string[],
  mediate: Mediator,
): Promise<RunOutcome> {
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
      return ctx.newString(JSON.stringify(await mediate(op, payload)))
    })
    host.consume((h) => { ctx.setProp(ctx.global, '__hostCall', h) })

    const harness = ctx.evalCode(GUEST_HARNESS)
    if (harness.error) {
      const e = ctx.dump(harness.error); harness.error.dispose()
      return { value: null, error: JSON.stringify(e), kind: 'isolate' }
    }
    harness.value.dispose()

    const declared = bindings
      .map((t) => `globalThis[${JSON.stringify(t)}] = { apiName: ${JSON.stringify(t)} }`)
      .join(';\n')
    if (declared !== '') {
      const b = ctx.evalCode(declared)
      if (b.error) { b.error.dispose() } else { b.value.dispose() }
    }

    // "The TypeScript function must be the default export of your file."
    // QuickJS evaluates a script, so the export binding is rewritten to the
    // harness's own — the authoring contract is unchanged for the author.
    const prepared = source.replace(/export\s+default\s+/, 'globalThis.__default = ')
    const loaded = ctx.evalCode(prepared)
    if (loaded.error) {
      const e = ctx.dump(loaded.error); loaded.error.dispose()
      return { value: null, error: JSON.stringify(e), kind: 'source' }
    }
    loaded.value.dispose()

    const argsJson = JSON.stringify(args).replace(/</g, '<')
    const started = await ctx.evalCodeAsync(`__start(${argsJson})`)
    if (started.error) {
      const e = ctx.dump(started.error); started.error.dispose()
      return { value: null, error: JSON.stringify(e), kind: 'execution' }
    }
    started.value.dispose()

    // Drain the microtask queue: every ontology read already returned, so the
    // function's own promise settles here.
    runtime.executePendingJobs()

    const handle = ctx.getProp(ctx.global, '__state')
    const state = ctx.dump(handle) as
      { done: boolean; value: string | null; error: string | null; userFacing?: boolean }
    handle.dispose()

    if (!state.done) return { value: null, error: 'the function never returned', kind: 'unsettled' }
    if (state.error !== null) {
      // An author's UserFacingError is a different outcome from a bug.
      return { value: null, error: state.error, kind: state.userFacing === true ? 'userFacing' : 'execution' }
    }
    return { value: JSON.parse(state.value ?? 'null'), error: null, kind: 'ok' }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    // The interrupt handler surfaces here when the deadline passes.
    if (message.includes('interrupt')) return { value: null, error: '60 seconds', kind: 'timeout' }
    return { value: null, error: message, kind: 'isolate' }
  } finally {
    ctx.dispose()
    runtime.dispose()
  }
}
