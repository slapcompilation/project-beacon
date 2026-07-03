import { describe, it, expect } from 'vitest'
import {
  classifyIntegrationHealth,
  selectIntegrationHealthAlerts,
  type IntegrationSourceReading,
} from './index'
import { DEFAULT_ORG_POLICY } from '../policy/index'

const RULE = DEFAULT_ORG_POLICY.monitors.integration // 120m warn, 1440m down, 720m stuck
const NOW = Date.parse('2026-07-03T12:00:00Z')

/** ISO timestamp `minutes` before NOW. */
function ago(minutes: number): string {
  return new Date(NOW - minutes * 60_000).toISOString()
}

function feed(over: Partial<IntegrationSourceReading> = {}): IntegrationSourceReading {
  return { sourceKey: 'pos:square', label: 'Square (POS)', kind: 'pos', lastActivityAt: ago(10), totalEvents: 500, ...over }
}

describe('classifyIntegrationHealth — live feeds', () => {
  it('fresh inside the warn window', () => {
    expect(classifyIntegrationHealth(feed({ lastActivityAt: ago(30) }), RULE, NOW).status).toBe('fresh')
  })
  it('stale between warn and down', () => {
    expect(classifyIntegrationHealth(feed({ lastActivityAt: ago(300) }), RULE, NOW).status).toBe('stale')
  })
  it('down past the down threshold', () => {
    const h = classifyIntegrationHealth(feed({ lastActivityAt: ago(2000) }), RULE, NOW)
    expect(h.status).toBe('down')
    expect(h.urgency).toBe(10)
  })
  it('never when it has fed no data', () => {
    const h = classifyIntegrationHealth(feed({ lastActivityAt: null }), RULE, NOW)
    expect(h.status).toBe('never')
    expect(h.staleMinutes).toBeNull()
  })
  it('the SLA is tunable — a tighter warn flips fresh to stale', () => {
    const tight = { ...RULE, warn_after_minutes: 5 }
    expect(classifyIntegrationHealth(feed({ lastActivityAt: ago(10) }), tight, NOW).status).toBe('stale')
  })
  it('stale urgency rises with age', () => {
    const near = classifyIntegrationHealth(feed({ lastActivityAt: ago(200) }), RULE, NOW).urgency
    const far  = classifyIntegrationHealth(feed({ lastActivityAt: ago(1200) }), RULE, NOW).urgency
    expect(far).toBeGreaterThan(near)
  })
})

describe('classifyIntegrationHealth — document pipeline', () => {
  const docs = (over: Partial<IntegrationSourceReading> = {}): IntegrationSourceReading => ({
    sourceKey: 'documents', label: 'Document ingestion', kind: 'documents',
    lastActivityAt: ago(5), totalEvents: 40, pendingCount: 0, oldestPendingAt: null, ...over,
  })

  it('fresh with no backlog', () => {
    expect(classifyIntegrationHealth(docs(), RULE, NOW).status).toBe('fresh')
  })
  it('fresh while a young backlog is still draining', () => {
    expect(classifyIntegrationHealth(docs({ pendingCount: 3, oldestPendingAt: ago(30) }), RULE, NOW).status).toBe('fresh')
  })
  it('stale once the oldest item waits past the stuck threshold', () => {
    const h = classifyIntegrationHealth(docs({ pendingCount: 3, oldestPendingAt: ago(800) }), RULE, NOW)
    expect(h.status).toBe('stale')
    expect(h.detail).toContain('3 awaiting')
  })
  it('down when the backlog is badly stalled', () => {
    expect(classifyIntegrationHealth(docs({ pendingCount: 12, oldestPendingAt: ago(2000) }), RULE, NOW).status).toBe('down')
  })
  it('idle uploads (no pending) never false-fire as stale', () => {
    // last activity is ancient but nothing is waiting — a sporadic feed, not a fault
    expect(classifyIntegrationHealth(docs({ lastActivityAt: ago(9000), pendingCount: 0 }), RULE, NOW).status).toBe('fresh')
  })
})

describe('selectIntegrationHealthAlerts', () => {
  it('drops fresh sources and sorts worst-first', () => {
    const hits = selectIntegrationHealthAlerts([
      feed({ sourceKey: 'pos:square', lastActivityAt: ago(30) }),          // fresh → dropped
      feed({ sourceKey: 'pms:mews',   lastActivityAt: ago(300) }),         // stale
      feed({ sourceKey: 'pos:toast',  lastActivityAt: null }),             // never (urgency 8)
      feed({ sourceKey: 'pms:opera',  lastActivityAt: ago(5000) }),        // down (urgency 10)
    ], RULE, NOW)
    expect(hits.map((h) => h.sourceKey)).toEqual(['pms:opera', 'pos:toast', 'pms:mews'])
  })
  it('disabled rule emits nothing', () => {
    expect(selectIntegrationHealthAlerts([feed({ lastActivityAt: null })], { ...RULE, enabled: false }, NOW)).toHaveLength(0)
  })
})
