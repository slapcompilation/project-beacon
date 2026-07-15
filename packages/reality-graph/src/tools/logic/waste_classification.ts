// One definition of "is this stock log waste?" shared by every consumer, so the
// waste view and the decision-quality metric can never disagree. A negative-delta
// log is waste when its removal_category is a waste tag, or its free-text reason
// matches a waste keyword.

import type { StockLogRow } from '../graph_reader'

export const WASTE_KEYWORDS = ['waste', 'spoil', 'expir', 'discard', 'damage', 'thrown', 'rot']
const WASTE_CATEGORIES = new Set(['waste', 'spoilage', 'damaged', 'expired'])

export function isWasteLog(log: StockLogRow): boolean {
  if (log.delta >= 0) return false
  const cat = (log.removal_category ?? '').toLowerCase()
  if (WASTE_CATEGORIES.has(cat)) return true
  const reason = (log.reason ?? '').toLowerCase()
  return WASTE_KEYWORDS.some((kw) => reason.includes(kw))
}
