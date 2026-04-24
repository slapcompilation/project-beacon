// Layer: Eye — AI-powered natural language import parser
// Parses free-form text into structured product create/update operations via Claude.

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

    // Verify the user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return json({ error: 'Unauthorized' }, 401)

    const body = await req.json() as {
      mode: 'create' | 'update'
      text: string
      available_categories?: { id: string; name: string }[]
      existing_skus?: string[]
    }

    if (!body.text?.trim()) return json({ error: 'Text input is required' }, 400)
    if (!body.mode || !['create', 'update'].includes(body.mode)) {
      return json({ error: 'Mode must be "create" or "update"' }, 400)
    }

    const categoryList = (body.available_categories ?? [])
      .map((c) => `- "${c.name}" (id: ${c.id})`)
      .join('\n')

    const skuList = (body.existing_skus ?? []).join(', ')

    const systemPrompt = body.mode === 'create'
      ? `You are a hotel inventory data parser. Extract structured product data from the user's natural language input.

Return ONLY valid JSON matching this exact schema — no markdown fences, no explanation outside the JSON:
{
  "products": [
    {
      "name": "Product Name",
      "sku": "PROD-SKU",
      "description": "optional description",
      "cost": 0,
      "category": "matched category name or null",
      "category_id": "matched category id or null",
      "initial_stock": 0,
      "tags": ["tag1", "tag2"]
    }
  ],
  "reasoning": "Brief explanation of how you interpreted the input",
  "confidence": "high" | "medium" | "low",
  "warnings": ["any ambiguities or items you couldn't fully parse"]
}

Rules:
1. "name" and "sku" are required for every product. If the user doesn't provide a SKU, generate one from the product name using uppercase abbreviation (e.g., "Towel Large" → "TOWEL-LG", "Sparkling Water 500ml" → "WATER-SPARK-500").
2. "cost" defaults to 0 if not specified.
3. Parse quantity from patterns like "x10", "× 10", "qty 10", "10 units of", "quantity: 10" → use as "initial_stock".
4. Parse tags from phrases like "with tags X,Y", "tagged X,Y", "tags: X, Y" → split into string array.
5. Match categories case-insensitively against the available list below. If no match, set category and category_id to null.
6. Set confidence to "high" if all items are clearly specified, "medium" if you had to infer some values, "low" if the input is very ambiguous.
7. Add to warnings any items you couldn't parse or any ambiguities you resolved by guessing.

Available categories:
${categoryList || '(none provided)'}
`
      : `You are a hotel inventory data parser. Extract stock update operations from the user's natural language input.

Return ONLY valid JSON matching this exact schema — no markdown fences, no explanation outside the JSON:
{
  "updates": [
    {
      "sku": "PROD-SKU",
      "action": "set" | "add" | "subtract",
      "quantity": 0,
      "cost": null,
      "description": null
    }
  ],
  "reasoning": "Brief explanation of how you interpreted the input",
  "confidence": "high" | "medium" | "low",
  "warnings": ["any ambiguities or items you couldn't fully parse"]
}

Rules:
1. Parse "set X to N" / "X = N" / "X now has N" → action: "set", quantity: N
2. Parse "add N to X" / "+N X" / "received N of X" → action: "add", quantity: N
3. Parse "remove N from X" / "-N X" / "used N of X" → action: "subtract", quantity: N
4. Match SKUs case-insensitively against the known SKU list below. Use the exact casing from the list.
5. If the user references a product by name instead of SKU, try to match it to a known SKU. If no match, include it in warnings.
6. quantity must always be a positive number (the action determines the direction).
7. Set confidence to "high" if all SKUs matched and operations are clear, "medium" if you had to infer, "low" if ambiguous.

Known SKUs:
${skuList || '(none provided)'}
`

    const anthropic = new Anthropic({ apiKey })

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      messages: [{ role: 'user', content: body.text }],
      system: systemPrompt,
    })

    const raw = (message.content[0] as { type: string; text: string }).text

    // Strip markdown fences if present
    const cleaned = raw.replace(/^```(?:json)?\s*\n?/m, '').replace(/\n?```\s*$/m, '').trim()

    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      return json({
        error: 'Failed to parse AI response',
        raw_response: raw,
      }, 422)
    }

    return json(parsed)

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return json({ error: `Internal error: ${message}` }, 500)
  }
})
