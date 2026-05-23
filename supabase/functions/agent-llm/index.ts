// Thin proxy: client sends LLMCallInput-shaped JSON, edge function calls
// Anthropic, returns LLMResponse-shaped JSON. ANTHROPIC_API_KEY lives only on
// the server. Authenticated users only.
//
// Block sub-LLMs use this for structured-output extraction + reasoning.
// The Beacon LLMClient interface in @beacon/reality-graph stays unchanged;
// only the impl in apps/web differs (AnthropicLLMClient vs HeuristicLLMClient).

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

interface AgentLLMRequest {
  systemPrompt: string
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  /** When set, the model is instructed to return JSON matching the schema's shape. */
  outputSchema?: unknown
  /** Optional max tokens; defaults to 1024. */
  maxTokens?: number
  /** Model id (defaults to claude-haiku-4-5-20251001 for speed/cost). */
  model?: string
}

interface AgentLLMResponse {
  output: unknown
  tokensUsed: number
}

const DEFAULT_MODEL = 'claude-haiku-4-5-20251001'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST')    return json({ error: 'POST only' }, 405)

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Unauthorized' }, 401)

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) return json({ error: 'ANTHROPIC_API_KEY secret not set' }, 500)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return json({ error: 'Unauthorized' }, 401)

    const body = await req.json() as AgentLLMRequest
    if (!body.systemPrompt || !body.messages || body.messages.length === 0) {
      return json({ error: 'systemPrompt and non-empty messages array required' }, 400)
    }

    // Force JSON output by appending a strict instruction to the system prompt.
    // The agent runtime parses the result through zod, which surfaces malformed
    // output as a typed error the orchestrator can surface in the trace.
    const systemWithJson = body.outputSchema
      ? `${body.systemPrompt}\n\nRespond with ONLY a JSON object matching this schema. No prose, no markdown fences:\n${JSON.stringify(body.outputSchema)}`
      : body.systemPrompt

    const anthropic = new Anthropic({ apiKey })
    const completion = await anthropic.messages.create({
      model:      body.model ?? DEFAULT_MODEL,
      max_tokens: body.maxTokens ?? 1024,
      system:     systemWithJson,
      messages:   body.messages,
    })

    const textBlock = completion.content.find((b) => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      return json({ error: 'no text in model response' }, 502)
    }

    let output: unknown
    if (body.outputSchema) {
      try {
        output = JSON.parse(textBlock.text.trim().replace(/^```(?:json)?\s*|\s*```$/g, ''))
      } catch {
        return json({ error: 'model returned non-JSON output', raw: textBlock.text }, 502)
      }
    } else {
      output = textBlock.text
    }

    const response: AgentLLMResponse = {
      output,
      tokensUsed: (completion.usage.input_tokens ?? 0) + (completion.usage.output_tokens ?? 0),
    }
    return json(response)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error'
    return json({ error: message }, 500)
  }
})
