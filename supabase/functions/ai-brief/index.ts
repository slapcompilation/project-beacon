// Layer: Eye — AI-generated daily brief edge function
// Fetches shift intelligence signals and synthesises an operator-ready brief via Claude.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.36.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Unauthorized' }, 401)

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) return json({ error: 'ANTHROPIC_API_KEY secret not set' }, 500)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    // Fetch intelligence signals as the authenticated user
    const { data: signals, error: signalsError } = await supabase.rpc('get_shift_intelligence', { p_window_days: 30 })
    if (signalsError) return json({ error: `Failed to fetch signals: ${signalsError.message}` }, 500)

    // Build signal list for prompt — top 8 by urgency (RPC already orders by urgency_score desc)
    const signalList = ((signals ?? []) as Record<string, unknown>[])
      .slice(0, 8)
      .map((s) =>
        `- [${String(s.signal_type).replace(/_/g, ' ')}] ${String(s.product_name)}${s.variant_name !== 'Standard' ? ` (${String(s.variant_name)})` : ''}: ${String(s.signal_note)} (urgency ${Math.round((s.urgency_score as number) * 100)}%, confidence ${Math.round((s.confidence as number) * 100)}%)`
      )
      .join('\n')

    const today = new Date().toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    })

    const prompt = `You are an AI assistant for a hotel operations manager. Generate a concise, operator-ready daily brief based on the current inventory intelligence data below.

Date: ${today}

ACTIVE SIGNALS (ranked by urgency):
${signalList || 'No active signals — all stock levels healthy.'}

Write a brief that:
1. Opens with a one-sentence overall status (good/attention needed/critical)
2. Lists the top 2-3 actions the operator should take TODAY, with specific product names
3. Notes any positive trends or things to monitor this week
4. Ends with a one-line procurement note if any items need ordering soon

Tone: direct, operational, confident. Maximum 150 words. No bullet points in the opening sentence. Use bullet points only for the action items.`

    const anthropic = new Anthropic({ apiKey })

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    })

    const brief = (message.content[0] as { type: string; text: string }).text

    return json({ brief, generated_at: new Date().toISOString() })

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return json({ error: `Internal error: ${message}` }, 500)
  }
})
