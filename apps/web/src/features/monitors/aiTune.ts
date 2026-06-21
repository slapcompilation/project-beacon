// The real LLM behind the heuristic monitor tuner (roadmap #1). Same job as
// parseExpiryTuning, but handles any monitor and any phrasing — it proxies the
// already-deployed agent-llm edge function (server-side key, structured JSON).
// The returned object is clamped through mergeOrgPolicy so the model can never
// push an out-of-range or malformed value into the policy.

import { supabase } from '@/lib/supabase/client'
import { mergeOrgPolicy, type OrgPolicy } from '@beacon/reality-graph'

type Monitors = OrgPolicy['monitors']

const SYSTEM = `You translate a hotelier's plain-English instruction into edits on a set of inventory monitors.
Apply ONLY what the instruction asks; leave every other field exactly as given. Return the COMPLETE updated
monitors object plus a one-line summary of what changed.

Field meanings:
- expiry.enabled / threshold_days (fire when a batch is within N days of expiry) / min_cost_at_risk (ignore batches under €N) / auto_propose (auto-create write-off proposals each cycle)
- stockout.enabled / threshold_days (surface when N days from zero stock)
- waste.enabled / min_anomaly_score (surface anomalies at/above this 0-10 score)
- supplier.enabled / max_reliability_score (surface suppliers at/below this 0-10 score; lower = worse)`

const SCHEMA = {
  monitors: {
    expiry:   { enabled: true, threshold_days: 7, min_cost_at_risk: 0, auto_propose: false },
    stockout: { enabled: true, threshold_days: 14 },
    waste:    { enabled: true, min_anomaly_score: 1 },
    supplier: { enabled: true, max_reliability_score: 6 },
  },
  summary: 'one short sentence',
}

interface AgentLLMResponse { output?: { monitors?: unknown; summary?: unknown }; error?: string }

export async function aiTuneMonitors(text: string, current: Monitors): Promise<{ monitors: Monitors; summary: string }> {
  const invokeResult = await supabase.functions.invoke<AgentLLMResponse>('agent-llm', {
    body: {
      systemPrompt: SYSTEM,
      messages: [{ role: 'user', content: `Current monitors: ${JSON.stringify(current)}\n\nInstruction: "${text}"` }],
      outputSchema: SCHEMA,
      maxTokens: 600,
    },
  })
  const data = invokeResult.data
  const error: unknown = invokeResult.error
  if (error instanceof Error) throw new Error(error.message)
  if (data?.error) throw new Error(data.error)

  const out = data?.output
  const rawMonitors: unknown = out?.monitors
  const rawSummary: unknown = out?.summary
  // Clamp the model's output through the same validator the policy doc uses —
  // missing monitors fall back to current, out-of-range values are bounded.
  const llm: Record<string, unknown> = isObj(rawMonitors) ? rawMonitors : {}
  const monitors = mergeOrgPolicy({ monitors: { ...current, ...llm } }).monitors
  const summary = typeof rawSummary === 'string' && rawSummary.trim() ? rawSummary.trim() : 'Updated monitors.'
  return { monitors, summary }
}

function isObj(x: unknown): x is Record<string, unknown> {
  return x != null && typeof x === 'object' && !Array.isArray(x)
}
