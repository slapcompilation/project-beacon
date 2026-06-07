// scenario-simulate — runs a scenario's overlay simulation server-side and
// caches the result. The single simulation path: both the operator's Simulate
// button (web useSimulateScenario) and the copilot's simulate_scenario tool
// resolve to the same runScenarioSimulation in _shared, so the client gateway
// duplication is gone.
//
// Auth: user JWT (verifyAuth) — the runner uses the caller's RLS-scoped client,
// so the operator can only simulate scenarios in their own scope. No service
// role.

import { json, preflight } from '../_shared/http.ts'
import { isAuthError, verifyAuth } from '../_shared/auth.ts'
import { runScenarioSimulation } from '../_shared/scenario-sim.ts'

Deno.serve(async (req: Request) => {
  const pre = preflight(req)
  if (pre) return pre
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)

  const auth = await verifyAuth(req)
  if (isAuthError(auth)) return auth
  const { supabase } = auth

  let scenarioId: string | undefined
  try {
    const body = await req.json() as { scenario_id?: string }
    scenarioId = body.scenario_id
  } catch {
    return json({ error: 'invalid JSON body' }, 400)
  }
  if (!scenarioId) return json({ error: 'scenario_id is required' }, 400)

  try {
    const summary = await runScenarioSimulation(supabase, scenarioId)
    return json({ ok: true, ...summary })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500)
  }
})
