// module-author — W7. Holds the API key, and nothing else.
//
// A thin adapter on purpose. The grammar, the prompt and the validation live in
// packages/reality-graph/src/authoring, where the eval suite can reach them —
// the lesson from #340, where a guard inlined into an edge function was
// eval-unreachable and drifted.
//
// THIS FUNCTION NEVER WRITES, and it is not the safety boundary either. The
// client validates with the same shared code, and the database's CHECK
// constraints refuse anything malformed regardless of who is asking. What this
// adds is the model call, which needs a secret the browser must not hold.

import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.36.3'
import { verifyAuth } from '../_shared/auth.ts'
import { json, corsHeaders } from '../_shared/http.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const auth = await verifyAuth(req)
  if (auth instanceof Response) return auth

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) return json({ error: 'Workshop:NoModelKey' }, 500)

  let body: { prompt?: string; request?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Workshop:BadRequest', message: 'Body must be JSON.' }, 400)
  }

  const prompt = (body.prompt ?? '').trim()
  const request = (body.request ?? '').trim()
  if (prompt === '' || request.length < 8) {
    return json({ error: 'Workshop:BadRequest',
      message: 'Both a prompt and a request of some substance are required.' }, 400)
  }

  try {
    const completion = await new Anthropic({ apiKey }).messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      system: prompt,
      messages: [{ role: 'user', content: request }],
    })
    const block = completion.content[0]
    return json({
      text: block.type === 'text' ? block.text : '',
      model: 'claude-haiku-4-5-20251001',
      tokens: completion.usage.input_tokens + completion.usage.output_tokens,
    })
  } catch (err) {
    // One attempt, no retry loop. A retry on a paid call is how a bad prompt
    // becomes a bill, and the operator can simply ask again.
    return json({
      error: 'Workshop:ModelUnavailable',
      message: err instanceof Error ? err.message : 'The model could not be reached.',
    }, 502)
  }
})
