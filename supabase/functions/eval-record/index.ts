// eval-record — opt-in CI sink for Vitest eval results.
//
// The vitest reporter in packages/reality-graph/src/evals/autoPersistReporter.ts
// POSTs here when EVAL_PERSIST_URL + EVAL_PERSIST_TOKEN env vars are set in
// the CI environment. We write one model_eval_runs row per record.
//
// Auth is a shared secret (X-Eval-Token header) so CI doesn't need to manage
// a service-role JWT. The secret EVAL_PERSIST_TOKEN must be set on the
// Supabase project; the GitHub Action passes the matching value via the
// custom header.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-eval-token',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

interface EvalRunRecord {
  objective_name:   string
  adapter_name:     string
  adapter_version:  string
  dataset:          string
  metric:           string
  value:            number
  case_count:       number
  subset?:          string
  commit_sha?:      string
  /** Phase G3 — per-case rows for this run. The handler inserts the
   *  aggregate first, then attaches these via the returned id. */
  cases?: Array<{
    case_id:        string
    case_label:     string
    state:          'passed' | 'failed' | 'skipped' | 'pending'
    duration_ms?:   number
    error_message?: string
  }>
}

interface RecordRequest {
  records: EvalRunRecord[]
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST')    return json({ error: 'POST only' }, 405)

  try {
    // Shared-secret auth so CI doesn't need a JWT.
    const expected = Deno.env.get('EVAL_PERSIST_TOKEN')
    if (!expected) return json({ error: 'EVAL_PERSIST_TOKEN secret not set on project' }, 500)
    const provided = req.headers.get('X-Eval-Token')
    if (provided !== expected) return json({ error: 'Unauthorized' }, 401)

    const body = await req.json() as RecordRequest
    if (!Array.isArray(body.records) || body.records.length === 0) {
      return json({ error: 'records array required' }, 400)
    }

    // Use the service role so RLS doesn't block CI inserts (no auth.uid()
    // in a CI request). The function still validates the shared secret
    // above, so write access is gated.
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!serviceKey) return json({ error: 'SUPABASE_SERVICE_ROLE_KEY not set' }, 500)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      serviceKey,
    )

    const rows = body.records.map((r) => ({
      organization_id:       null,           // CI runs are not org-scoped
      objective_name:        r.objective_name,
      adapter_name:          r.adapter_name,
      adapter_version:       r.adapter_version,
      dataset:               r.dataset,
      metric:                r.metric,
      value:                 r.value,
      case_count:            r.case_count,
      subset:                r.subset ?? (r.commit_sha ? `commit:${r.commit_sha.slice(0, 7)}` : 'overall'),
      triggered_by_user_id:  null,
    }))

    // Insert the aggregate rows first; capture ids so we can attach per-case
    // rows to the correct parent run.
    const { data: inserted, error: insertError } = await supabase
      .from('model_eval_runs')
      .insert(rows)
      .select('id')

    if (insertError) return json({ error: insertError.message }, 502)
    const insertedIds = (inserted ?? []) as Array<{ id: string }>

    // Phase G3 — flatten cases[] onto the inserted run ids in the same order.
    const caseRows: Array<Record<string, unknown>> = []
    for (let i = 0; i < body.records.length; i++) {
      const r  = body.records[i]
      const id = insertedIds[i]?.id
      if (!id || !r.cases || r.cases.length === 0) continue
      for (const c of r.cases) {
        caseRows.push({
          eval_run_id:     id,
          objective_name:  r.objective_name,
          adapter_version: r.adapter_version,
          case_id:         c.case_id,
          case_label:      c.case_label,
          state:           c.state,
          duration_ms:     c.duration_ms ?? null,
          error_message:   c.error_message ?? null,
        })
      }
    }

    let caseCount = 0
    if (caseRows.length > 0) {
      const { error: caseErr, count } = await supabase
        .from('agent_eval_case_runs')
        .insert(caseRows, { count: 'exact' })
      if (caseErr) return json({ error: `case insert failed: ${caseErr.message}` }, 502)
      caseCount = count ?? caseRows.length
    }

    return json({ inserted: insertedIds.length, cases: caseCount })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error'
    return json({ error: message }, 500)
  }
})
