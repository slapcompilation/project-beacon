import { describe, expect, it } from 'vitest'
import { recommendAdapterPromotion } from './promotion'

const e = (name: string, value: number, version = '1.0.0') => ({ name, version, value })

describe('recommendAdapterPromotion', () => {
  it('holds when there are no eval runs', () => {
    expect(recommendAdapterPromotion([], null).action).toBe('hold')
  })

  it('promotes the best adapter when nothing is in production', () => {
    const r = recommendAdapterPromotion([e('ewma-v1', 0.2), e('holt-linear-v1', 0.14)], null)
    expect(r.action).toBe('promote')
    expect(r.winner?.name).toBe('holt-linear-v1')
  })

  it('holds when production already runs the best adapter', () => {
    const r = recommendAdapterPromotion([e('holt-linear-v1', 0.14), e('ewma-v1', 0.2)], { name: 'holt-linear-v1', version: '1.0.0' })
    expect(r.action).toBe('hold')
  })

  it('promotes when a challenger clearly beats production', () => {
    const r = recommendAdapterPromotion([e('ewma-v1', 0.30), e('holt-linear-v1', 0.14)], { name: 'ewma-v1', version: '1.0.0' })
    expect(r.action).toBe('promote')
    expect(r.winner?.name).toBe('holt-linear-v1')
  })

  it('holds when production is within the margin of the best (no churn)', () => {
    const r = recommendAdapterPromotion([e('ewma-v1', 0.205), e('holt-linear-v1', 0.20)], { name: 'ewma-v1', version: '1.0.0' })
    expect(r.action).toBe('hold')   // 0.20 is only ~2.5% better than 0.205, under the 5% margin
  })
})
