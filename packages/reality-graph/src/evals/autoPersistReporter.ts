// Vitest reporter that opt-in posts per-eval-file pass rates to the
// eval-record edge function. Activates when EVAL_PERSIST_TOKEN and
// EVAL_PERSIST_URL env vars are both set — usually only in CI.
//
// One row per `*.eval.ts` file with metric='pass_rate' and value=fraction
// of test cases that passed. Adapter-version derived from filename
// convention `<adapter>.eval.ts` or `<agent>.eval.ts`; objective_name
// defaults to the agent's name when the suite is co-located with an agent.

// Reporter only ever runs inside Vitest (Node). Declare the Node globals we
// touch so we don't pull @types/node into the package surface.
declare const process: { env: Record<string, string | undefined> }
declare const console: { log: (...args: unknown[]) => void; warn: (...args: unknown[]) => void }
declare const fetch: (url: string, init?: {
  method?:  string
  headers?: Record<string, string>
  body?:    string
}) => Promise<{ ok: boolean; status: number }>
declare const setTimeout: (cb: () => void, ms: number) => unknown

export interface EvalRunRecord {
  objective_name:  string
  adapter_name:    string
  adapter_version: string
  dataset:         string
  metric:          'pass_rate'
  value:           number
  case_count:      number
  subset:          string
  /** git sha of the commit under test; populated from env when available. */
  commit_sha?:     string
  /** Per-test results, so the diff UI can show which exact cases regressed.
   *  `group` is the describe-block path — authors slice cohorts with it
   *  (e.g. describe('cohort: Valinor')). */
  cases?:          ReadonlyArray<{ name: string; passed: boolean; group?: string }>
}

interface FileTally {
  total:  number
  passed: number
}

/** Loose Vitest 4 TestModule shape — we structural-type on just the fields
 *  we read so the reporter stays decoupled from Vitest's full reporter typings. */
interface ReporterTestCase {
  name: string
  /** Vitest 4: "suite > nested > test name". */
  fullName?: string
  result: () => { state: 'passed' | 'failed' | 'skipped' | 'pending' }
}
interface ReporterTestCollection {
  allTests: () => Iterable<ReporterTestCase>
}
interface ReporterTestModule {
  moduleId: string
  children: ReporterTestCollection
}

/**
 * Returns a Vitest reporter object that records one row per `*.eval.ts`
 * file when EVAL_PERSIST_TOKEN + EVAL_PERSIST_URL env vars are set. No-op
 * otherwise so local dev runs stay side-effect free.
 *
 * Loosely typed so it works across Vitest 3/4 reporter API differences;
 * Vitest accepts any object with the recognized lifecycle hooks.
 */
export function evalAutoPersistReporter(): {
  onInit: () => void
  onTestRunEnd: (testModules: ReadonlyArray<ReporterTestModule>) => Promise<void>
} {
  const url    = process.env.EVAL_PERSIST_URL
  const token  = process.env.EVAL_PERSIST_TOKEN
  const sha    = process.env.GITHUB_SHA ?? process.env.GIT_COMMIT ?? undefined

  // No-op fast-path when either env var is missing.
  const enabled = !!url && !!token

  return {
    onInit() {
      if (!enabled) {
        // eslint-disable-next-line no-console
        console.log('[eval-persist] disabled (EVAL_PERSIST_URL / EVAL_PERSIST_TOKEN not set)')
      }
    },

    async onTestRunEnd(testModules) {
      if (!enabled) return

      const records: EvalRunRecord[] = []
      try {
        for (const mod of testModules) {
          const filepath = mod.moduleId
          if (!filepath.endsWith('.eval.ts')) continue
          const tally: FileTally = { total: 0, passed: 0 }
          const cases: { name: string; passed: boolean; group?: string }[] = []
          for (const tc of mod.children.allTests()) {
            tally.total += 1
            const passed = tc.result().state === 'passed'
            if (passed) tally.passed += 1
            const full = tc.fullName
            const group = full && full !== tc.name && full.endsWith(tc.name)
              ? full.slice(0, full.length - tc.name.length).replace(/ > $/, '').trim() || undefined
              : undefined
            cases.push({ name: tc.name, passed, ...(group ? { group } : {}) })
          }
          if (tally.total === 0) continue

          const meta = inferEvalMeta(filepath)
          records.push({
            objective_name:  meta.objectiveName,
            adapter_name:    meta.adapterName,
            adapter_version: meta.adapterVersion,
            dataset:         meta.dataset,
            metric:          'pass_rate',
            value:           Number((tally.passed / tally.total).toFixed(4)),
            case_count:      tally.total,
            subset:          'overall',
            commit_sha:      sha,
            cases,
          })
        }
      } catch (err: unknown) {
        // eslint-disable-next-line no-console
        console.warn('[eval-persist] error walking modules:', err)
        return
      }

      if (records.length === 0) {
        // eslint-disable-next-line no-console
        console.log('[eval-persist] no *.eval.ts files in this run — nothing to upload')
        return
      }

      // Vitest 4 awaits onTestRunEnd. Cap the POST at 10s so a slow endpoint
      // can't hang CI.
      const timeoutMs = 10_000
      try {
        const res = await Promise.race<{ ok: boolean; status: number }>([
          fetch(url, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json', 'X-Eval-Token': token },
            body:    JSON.stringify({ records }),
          }),
          new Promise((resolve) => setTimeout(() => resolve({ ok: false, status: 0 }), timeoutMs)),
        ])
        if (!res.ok) {
          // eslint-disable-next-line no-console
          console.warn(`[eval-persist] POST returned ${String(res.status)} (timeout or HTTP error)`)
        } else {
          // eslint-disable-next-line no-console
          console.log(`[eval-persist] uploaded ${String(records.length)} run(s)`)
        }
      } catch (err: unknown) {
        // eslint-disable-next-line no-console
        console.warn('[eval-persist] POST failed:', err)
      }
    },
  }
}

function inferEvalMeta(filepath: string): {
  objectiveName: string
  adapterName: string
  adapterVersion: string
  dataset: string
} {
  // Filename convention: <something>.eval.ts. Strip extension; default
  // versions to '1.0.0' (Phase 19 keeps versioning manual — future
  // upgrade: parse a leading `@semver` from the suite-level describe()).
  const normalized = filepath.replace(/\\/g, '/')
  const m = /\/([^/]+)\.eval\.ts$/.exec(normalized)
  const stem = m?.[1] ?? 'unknown'

  // Co-located convention: packages/reality-graph/src/agents/<agent_name>/eval/<stem>.eval.ts
  // → objective_name = agent_name. Fallback: stem.
  const agentMatch = /\/agents\/([^/]+)\/eval\//.exec(normalized)
  const objectiveName = agentMatch?.[1] ?? stem

  return {
    objectiveName,
    adapterName:    stem,
    adapterVersion: '1.0.0',
    dataset:        'vitest:default',
  }
}
