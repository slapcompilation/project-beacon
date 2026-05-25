// Lightweight Jaccard token-overlap similarity. Sufficient for the v1
// ApprovedAnswers cache lookup; pgvector + cosine similarity is the v2
// upgrade path (the table already has an embedding_ref column reserved).

const STOPWORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'do', 'does', 'did', 'i', 'you', 'we', 'they',
  'and', 'or', 'but', 'of', 'in', 'on', 'for', 'to', 'with', 'as', 'at', 'by',
  'be', 'been', 'being', 'have', 'has', 'had', 'this', 'that', 'these', 'those',
  'it', 'its', 'will', 'would', 'should', 'can', 'could', 'may', 'might',
])

export function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter((t) => t.length >= 2 && !STOPWORDS.has(t)),
  )
}

export function jaccardSimilarity(a: string, b: string): number {
  const ta = tokenize(a)
  const tb = tokenize(b)
  if (ta.size === 0 || tb.size === 0) return 0
  let inter = 0
  ta.forEach((t) => { if (tb.has(t)) inter++ })
  const union = ta.size + tb.size - inter
  return union === 0 ? 0 : inter / union
}

export interface SimilarityMatch<T> {
  item: T
  score: number
}

/** Finds the highest-scoring entry above the threshold. Returns null on miss. */
export function bestMatch<T>(
  query: string,
  items: ReadonlyArray<T>,
  getQuestion: (item: T) => string,
  threshold = 0.6,
): SimilarityMatch<T> | null {
  let best: SimilarityMatch<T> | null = null
  for (const item of items) {
    const score = jaccardSimilarity(query, getQuestion(item))
    if (score >= threshold && (!best || score > best.score)) {
      best = { item, score }
    }
  }
  return best
}
