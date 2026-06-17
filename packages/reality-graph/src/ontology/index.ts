// Self-evolving ontology — detect what the data already contains that the typed
// ontology can't yet express, and propose typed extensions for the operator to
// approve.
//
// 1. Layer: compute. Pure, deterministic detection over a data source; no I/O.
// 2. Ontology fit: reads existing nodes/fields, proposes typed extensions to
//    them. Output is a reviewable proposal, never a runtime schema mutation —
//    the ontology stays typed code, grown under operator review.
// 3. Scope: caller supplies the rows to scan (hotel or org); the math is
//    scope-agnostic.
//
// Detection is a registry of small detectors over one shared core
// (detectReasonCategoryGaps): map free-text to a canonical category via a
// keyword lexicon, then aggregate. Today: stock-removal reasons (removal_category)
// and stock-addition reasons (movement_category). New gap kinds plug in here.

export type OntologyGapKind =
  | 'new_category'    // a recurring free-text value that should be a typed enum member
  | 'new_edge_type'   // a relationship type in the graph that the type system doesn't declare
// future: 'new_computed_property' | 'new_node_attribute'

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
  /** Field the extension refines (e.g. 'removal_category'). */
  targetField: string
  /** The proposed typed value / name (e.g. 'Spoilage'). */
  proposed: string
  /** One line the operator reads to decide. */
  rationale: string
  evidence: OntologyGapEvidence
  /** 0..1 — how strongly the data backs adding this type. */
  confidence: number
}

interface LexiconEntry { category: string; keywords: ReadonlyArray<string> }

// Canonical category values are Title-Case to match the rest of the system —
// the RemovalCategory union (@beacon/types), the StockAdjust modal, and the
// reporting/security SQL (theft trigger, waste radar, GL export) all filter on
// 'Theft' / 'Breakage' / 'Spoilage'. Emitting lowercase here meant an approved
// gap was written in a vocabulary nothing downstream recognized.

/** Keyword → canonical category for stock REMOVALS. First entry whose any
 *  keyword is a substring of the normalized reason wins, so order = priority. */
const REMOVAL_LEXICON: ReadonlyArray<LexiconEntry> = [
  { category: 'Spoilage',      keywords: ['spoil', 'expire', 'expired', 'perish', 'out of date', 'past date', 'rotten', 'mould', 'mold'] },
  { category: 'Breakage',      keywords: ['damage', 'broke', 'broken', 'breakage', 'spill', 'spilt', 'dropped', 'crack'] },
  { category: 'Theft',         keywords: ['theft', 'stolen', 'steal', 'shrink', 'pilfer', 'missing'] },
  { category: 'Transfer',      keywords: ['transfer', 'moved to', 'sent to', 'relocat'] },
  { category: 'Correction',    keywords: ['correct', 'recount', 'cycle count', 'count adjust', 'audit', 'reconcil', 'stocktake'] },
  { category: 'Complimentary', keywords: ['comp ', 'complimentary', 'gratis', 'on the house', 'tasting', 'sample'] },
  { category: 'Consumed',      keywords: ['consum', 'pos', 'sale', 'sold', 'usage', 'used', 'depletion', 'served'] },
]

/** Keyword → canonical category for stock ADDITIONS. */
const ADDITION_LEXICON: ReadonlyArray<LexiconEntry> = [
  { category: 'Receipt',     keywords: ['receiv', 'deliver', 'restock', 'purchase', ' po ', 'arriv', 'inbound', 'goods in'] },
  { category: 'Return',      keywords: ['return', 'refund', 'sent back', 'put back'] },
  { category: 'Transfer',    keywords: ['transfer', 'moved in', 'from sister', 'inter-property', 'inbound transfer'] },
  { category: 'Correction',  keywords: ['correct', 'recount', 'found', 'cycle count', 'audit', 'reconcil', 'stocktake', 'adjust'] },
  { category: 'Production',  keywords: ['made', 'produced', 'prepped', 'batch', 'in-house', 'in house'] },
]

/** Generic row the category detectors scan: a free-text reason + the typed
 *  category already on the row (null when not yet typed, or when the concept
 *  has no column at all). */
export interface ReasonRow {
  reason: string | null
  category: string | null
}

export interface DetectReasonCategoryConfig {
  lexicon: ReadonlyArray<LexiconEntry>
  /** Node type the extension attaches to (e.g. 'StockLog'). */
  targetType: string
  /** Field the typed category would live on (e.g. 'removal_category'). */
  targetField: string
  /** Plural noun for the rationale (e.g. 'removals', 'stock additions'). */
  noun: string
  /** Categories already recognized — never re-proposed. */
  knownCategories?: ReadonlyArray<string>
  /** Minimum supporting rows before a category is proposed. Default 3. */
  minSupport?: number
  /** Max example phrasings kept per gap. Default 3. */
  maxExamples?: number
}

/**
 * The shared detector core. Scans rows whose typed `category` isn't set yet,
 * maps each free-text `reason` to a canonical category via the config's lexicon,
 * aggregates, and proposes the recurring ones. Deterministic; returns proposals
 * descending by support.
 */
export function detectReasonCategoryGaps(
  rows: ReadonlyArray<ReasonRow>,
  config: DetectReasonCategoryConfig,
): OntologyGap[] {
  const minSupport  = config.minSupport ?? 3
  const maxExamples = config.maxExamples ?? 3
  const known = new Set((config.knownCategories ?? []).map((c) => c.toLowerCase()))

  // Only untyped rows carry signal — a row already typed is no gap.
  const untyped = rows.filter(
    (r) => (r.category == null || r.category.trim() === '')
      && r.reason != null && r.reason.trim() !== '',
  )
  const totalConsidered = untyped.length
  if (totalConsidered === 0) return []

  const buckets = new Map<string, { count: number; examples: Set<string> }>()
  for (const r of untyped) {
    const category = classify(r.reason!, config.lexicon)
    // known is lowercased; canonical categories are Title-Case — compare folded.
    if (category == null || known.has(category.toLowerCase())) continue
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
      targetType: config.targetType,
      targetField: config.targetField,
      proposed: category,
      rationale:
        `${String(b.count)} of ${String(totalConsidered)} untyped ${config.noun} ` +
        `(${pct(coverage)}) read as "${category}" but are stored only as free text — ` +
        `promote it to a typed ${config.targetField}.`,
      evidence: { occurrences: b.count, totalConsidered, coverage, examples: [...b.examples] },
      // Recurrence drives confidence: a category covering most rows is an
      // unmistakable gap; a long-tail one is a weaker suggestion.
      confidence: round2(0.55 + 0.42 * coverage),
    })
  }

  return gaps.sort((a, b) => b.evidence.occurrences - a.evidence.occurrences)
}

// ── Concrete detectors ────────────────────────────────────────────────────────

export interface RemovalReasonRow {
  reason: string | null
  removal_category: string | null
}

export interface DetectRemovalCategoryOptions {
  knownCategories?: ReadonlyArray<string>
  minSupport?: number
  maxExamples?: number
}

/** Stock removals → typed removal_category. */
export function detectRemovalCategoryGaps(
  rows: ReadonlyArray<RemovalReasonRow>,
  opts: DetectRemovalCategoryOptions = {},
): OntologyGap[] {
  return detectReasonCategoryGaps(
    rows.map((r) => ({ reason: r.reason, category: r.removal_category })),
    { lexicon: REMOVAL_LEXICON, targetType: 'StockLog', targetField: 'removal_category', noun: 'removals', ...opts },
  )
}

/** Free-text reason on a stock addition + the typed movement_category once set. */
export interface AdditionReasonRow {
  reason: string | null
  movement_category?: string | null
}

/** Stock additions → typed movement_category. Once a movement is typed it drops
 *  out of the gaps (same as removals), so detection narrows as the ontology grows. */
export function detectAdditionCategoryGaps(
  rows: ReadonlyArray<AdditionReasonRow>,
  opts: DetectRemovalCategoryOptions = {},
): OntologyGap[] {
  return detectReasonCategoryGaps(
    rows.map((r) => ({ reason: r.reason, category: r.movement_category ?? null })),
    { lexicon: ADDITION_LEXICON, targetType: 'StockLog', targetField: 'movement_category', noun: 'stock additions', ...opts },
  )
}

// ── Edge-type drift detector (a different gap KIND) ─────────────────────────────

export interface EdgeTypeCount {
  edge_type: string
  count: number
}

export interface DetectUntypedEdgeOptions {
  /** Edge types the type system declares (reality-graph's EDGE_TYPES). */
  knownEdgeTypes: ReadonlyArray<string>
  /** Minimum edges before an untyped type is flagged. Default 1. */
  minSupport?: number
}

/**
 * Flags relationship types present in the graph that aren't declared in the typed
 * EdgeType union — type-system drift (code writing edges the ontology doesn't
 * know). On a healthy graph this is empty; it fires when an edge type slips in
 * untyped. The fix is a code change (add it to EdgeType), so approval here is a
 * tracked, audited request, not a runtime mutation.
 */
export function detectUntypedEdgeGaps(
  counts: ReadonlyArray<EdgeTypeCount>,
  opts: DetectUntypedEdgeOptions,
): OntologyGap[] {
  const minSupport = opts.minSupport ?? 1
  const known = new Set(opts.knownEdgeTypes)
  const total = counts.reduce((s, c) => s + c.count, 0)
  if (total === 0) return []

  const gaps: OntologyGap[] = []
  for (const { edge_type, count } of counts) {
    if (known.has(edge_type) || count < minSupport) continue
    gaps.push({
      kind: 'new_edge_type',
      targetType: 'RelationshipEdge',
      targetField: 'edge_type',
      proposed: edge_type,
      rationale:
        `${String(count)} edges use the relationship type "${edge_type}" but it isn't declared ` +
        `in the typed EdgeType union — formalize it (or migrate the edges away).`,
      evidence: { occurrences: count, totalConsidered: total, coverage: count / total, examples: [edge_type] },
      // A type the data uses but the system doesn't know is an unambiguous gap.
      confidence: 0.9,
    })
  }
  return gaps.sort((a, b) => b.evidence.occurrences - a.evidence.occurrences)
}

function classify(reason: string, lexicon: ReadonlyArray<LexiconEntry>): string | null {
  const norm = reason.toLowerCase()
  for (const entry of lexicon) {
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
