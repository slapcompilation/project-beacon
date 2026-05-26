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

    const { error: insertError, count } = await supabase
      .from('model_eval_runs')
      .insert(rows, { count: 'exact' })

    if (insertError) return json({ error: insertError.message }, 502)

    return json({ inserted: count ?? rows.length })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error'
    return json({ error: message }, 500)
  }
})
