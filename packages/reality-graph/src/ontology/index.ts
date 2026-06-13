// Self-evolving ontology — step 1: detect what the data already contains that
// the typed ontology can't yet express, and propose typed extensions for the
// operator to approve.
//
// 1. Layer: compute. Pure, deterministic detection over a data source; no I/O.
// 2. Ontology fit: reads existing nodes/fields, proposes typed extensions to
//    them (a new category value today; new edge types / computed properties as
//    later detectors register). Output is a reviewable proposal, never a runtime
//    schema mutation — the ontology stays typed code, grown under operator review.
// 3. Scope: caller supplies the rows to scan (hotel or org); the math is
//    scope-agnostic.
//
// First detector: stock-removal reasons. Operators (and POS imports) describe
// every removal in free text while the typed `removal_category` sits unused —
// a concept the data carries but the ontology doesn't capture.

export type OntologyGapKind =
  | 'new_category'   // a recurring free-text value that should be a typed enum member
// future: 'new_edge_type' | 'new_computed_property' | 'new_node_attribute'

export interface OntologyGapEvidence {
  /** Rows supporting this specific proposal. */
  occurrences: number
  /** Rows scanned (the honest denominator). */
  totalConsidered: number
  /** occurrences / totalConsidered, 0..1. */
  coverage: number
  /** A few raw phrasings that mapped here, deduped + capped. */
  examples: string[]
}

export interface OntologyGap {
  kind: OntologyGapKind
  /** Existing node type the extension attaches to (e.g. 'StockLog'). */
  targetType: string
  /** Existing field the extension refines (e.g. 'removal_category'). */
  targetField: string
  /** The proposed typed value / name (e.g. 'spoilage'). */
  proposed: string
  /** One line the operator reads to decide. */
  rationale: string
  evidence: OntologyGapEvidence
  /** 0..1 — how strongly the data backs adding this type. */
  confidence: number
}

/** Keyword → canonical removal category. First entry whose any keyword is a
 *  substring of the normalized reason wins, so order = priority. */
const REMOVAL_LEXICON: ReadonlyArray<{ category: string; keywords: ReadonlyArray<string> }> = [
  { category: 'spoilage',      keywords: ['spoil', 'expire', 'expired', 'perish', 'out of date', 'past date', 'rotten', 'mould', 'mold'] },
  { category: 'damage',        keywords: ['damage', 'broke', 'broken', 'breakage', 'spill', 'spilt', 'dropped', 'crack'] },
  { category: 'theft',         keywords: ['theft', 'stolen', 'steal', 'shrink', 'pilfer', 'missing'] },
  { category: 'transfer',      keywords: ['transfer', 'moved to', 'sent to', 'relocat'] },
  { category: 'correction',    keywords: ['correct', 'recount', 'cycle count', 'count adjust', 'audit', 'reconcil', 'stocktake'] },
  { category: 'complimentary', keywords: ['comp ', 'complimentary', 'gratis', 'on the house', 'tasting', 'sample'] },
  { category: 'consumption',   keywords: ['consum', 'pos', 'sale', 'sold', 'usage', 'used', 'depletion', 'served'] },
]

export interface RemovalReasonRow {
  reason: string | null
  removal_category: string | null
}

export interface DetectRemovalCategoryOptions {
  /** Categories already recognized by the ontology — never re-proposed. */
  knownCategories?: ReadonlyArray<string>
  /** Minimum supporting rows before a category is proposed. Default 3. */
  minSupport?: number
  /** Max example phrasings kept per gap. Default 3. */
  maxExamples?: number
}

/**
 * Scans removal stock-logs and proposes typed `removal_category` values for the
 * recurring free-text reasons that aren't categorized yet. Deterministic: maps
 * each reason to a canonical category via a keyword lexicon, then aggregates.
 * Returns proposals descending by support.
 */
export function detectRemovalCategoryGaps(
  rows: ReadonlyArray<RemovalReasonRow>,
  opts: DetectRemovalCategoryOptions = {},
): OntologyGap[] {
  const minSupport  = opts.minSupport ?? 3
  const maxExamples = opts.maxExamples ?? 3
  const known = new Set((opts.knownCategories ?? []).map((c) => c.toLowerCase()))

  // Only uncategorized removals carry signal — a row already typed is no gap.
  const uncategorized = rows.filter(
    (r) => (r.removal_category == null || r.removal_category.trim() === '')
      && r.reason != null && r.reason.trim() !== '',
  )
  const totalConsidered = uncategorized.length
  if (totalConsidered === 0) return []

  const buckets = new Map<string, { count: number; examples: Set<string> }>()
  for (const r of uncategorized) {
    const category = classifyReason(r.reason!)
    if (category == null || known.has(category)) continue
    let b = buckets.get(category)
    if (!b) { b = { count: 0, examples: new Set() }; buckets.set(category, b) }
    b.count++
    if (b.examples.size < maxExamples) b.examples.add(r.reason!.trim())
  }

  const gaps: OntologyGap[] = []
  for (const [category, b] of buckets) {
    if (b.count < minSupport) continue
    const coverage = b.count / totalConsidered
    gaps.push({
      kind: 'new_category',
      targetType: 'StockLog',
      targetField: 'removal_category',
      proposed: category,
      rationale:
        `${String(b.count)} of ${String(totalConsidered)} uncategorized removals ` +
        `(${pct(coverage)}) read as "${category}" but are stored only as free text — ` +
        `promote it to a typed removal_category.`,
      evidence: {
        occurrences: b.count,
        totalConsidered,
        coverage,
        examples: [...b.examples],
      },
      // Recurrence drives confidence: a category covering most removals is an
      // unmistakable gap; a long-tail one is a weaker suggestion.
      confidence: round2(0.55 + 0.42 * coverage),
    })
  }

  return gaps.sort((a, b) => b.evidence.occurrences - a.evidence.occurrences)
}

function classifyReason(reason: string): string | null {
  const norm = reason.toLowerCase()
  for (const entry of REMOVAL_LEXICON) {
    if (entry.keywords.some((k) => norm.includes(k))) return entry.category
  }
  return null
}

function pct(x: number): string {
  return `${String(Math.round(x * 100))}%`
}

function round2(x: number): number {
  return Math.round(x * 100) / 100
}
