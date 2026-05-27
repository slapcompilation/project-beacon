// Categorizes operator principle text into one of six AIP buckets.
// Tries the agent-llm edge function first (true LLM-as-categorizer per the
// AIP transcripts); on failure or unavailable falls back to a small keyword
// classifier so the flow never blocks.

import { z } from 'zod'
import { supabase } from '@/lib/supabase/client'
import type { PrincipleCategory } from '@beacon/reality-graph'

const CATEGORY_OPTIONS: PrincipleCategory[] = [
  'inventory-policy',
  'supplier-preference',
  'time-window',
  'budget',
  'compliance',
  'other',
]

const HEURISTIC_RULES: { category: PrincipleCategory; markers: RegExp[] }[] = [
  { category: 'supplier-preference', markers: [/\bsupplier\b/, /\bprefer\b/, /\bvendor\b/] },
  { category: 'time-window',         markers: [/\bafter\b\s+\d/, /\bbefore\b\s+\d/, /\bweekend\b/, /\bovernight\b/, /\bbusiness hours\b/] },
  { category: 'budget',              markers: [/\bbudget\b/, /\bcost\b/, /\b\$\d/, /\b€\d/, /\bspend\b/] },
  { category: 'compliance',          markers: [/\bcompliance\b/, /\bregulation\b/, /\baudit\b/, /\bgdpr\b/, /\blegal\b/] },
  { category: 'inventory-policy',    markers: [/\bstock\b/, /\bpar\b/, /\brestock\b/, /\bquantity\b/, /\bcount\b/] },
]

const categorizationSchema = z.object({
  category: z.enum(['inventory-policy', 'supplier-preference', 'time-window', 'budget', 'compliance', 'other']),
})

interface EdgeFunctionResponse {
  output?: { category?: string }
  error?: string
}

export async function categorizePrinciple(body: string): Promise<PrincipleCategory> {
  const text = body.trim()
  if (!text) return 'other'

  try {
    const result = await supabase.functions.invoke<EdgeFunctionResponse>('agent-llm', {
      body: {
        systemPrompt:
          'You categorize an operator-authored business principle into exactly one bucket. ' +
          `Pick from: ${CATEGORY_OPTIONS.join(', ')}. Return only the category.`,
        messages: [{ role: 'user', content: text }],
        outputSchema: { category: `one of ${CATEGORY_OPTIONS.join(' | ')}` },
        maxTokens: 64,
      },
    }) as { data: EdgeFunctionResponse | null; error: { message: string } | null }
    const { data, error } = result
    if (!error && data?.output) {
      const parsed = categorizationSchema.safeParse(data.output)
      if (parsed.success) return parsed.data.category
    }
  } catch {
    // Edge function unavailable — fall back to heuristic.
  }

  return heuristicCategorize(text)
}

function heuristicCategorize(text: string): PrincipleCategory {
  const lower = text.toLowerCase()
  for (const rule of HEURISTIC_RULES) {
    if (rule.markers.some((rx) => rx.test(lower))) return rule.category
  }
  return 'other'
}
