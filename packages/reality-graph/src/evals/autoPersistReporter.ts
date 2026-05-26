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
}

interface FileTally {
  total:  number
  passed: number
}

/** Loose Vitest task shape — the public Reporter type changes between
 *  versions; we structural-type on just the fields we read. */
interface ReporterTask {
  type:      string
  filepath?: string
  result?:   { state?: string }
  tasks?:    ReporterTask[]
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
  onFinished: (files?: ReporterTask[]) => void
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

    onFinished(files = []) {
      if (!enabled) return

      const records: EvalRunRecord[] = []
      for (const file of files) {
        const filepath = file.filepath
        if (!filepath || !filepath.endsWith('.eval.ts')) continue
        const tally: FileTally = { total: 0, passed: 0 }
        countTests(file, tally)
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
        })
      }

      if (records.length === 0) return

      // Fire-and-forget POST. We deliberately don't await — the runner exits
      // after this hook and we don't want CI hangs if the endpoint is slow.
      void fetch(url, {
        method:  'POST',
        headers: {
          'Content-Type':   'application/json',
          'X-Eval-Token':   token,
        },
        body: JSON.stringify({ records }),
      }).then((res) => {
        if (!res.ok) {
          // eslint-disable-next-line no-console
          console.warn(`[eval-persist] POST returned ${String(res.status)}`)
        } else {
          // eslint-disable-next-line no-console
          console.log(`[eval-persist] uploaded ${String(records.length)} run(s)`)
        }
      }).catch((err: unknown) => {
        // eslint-disable-next-line no-console
        console.warn('[eval-persist] POST failed:', err)
      })
    },
  }
}

function countTests(node: ReporterTask, tally: FileTally): void {
  if (node.type === 'test') {
    tally.total += 1
    if (node.result?.state === 'pass') tally.passed += 1
    return
  }
  if (node.tasks && Array.isArray(node.tasks)) {
    for (const child of node.tasks) countTests(child, tally)
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
