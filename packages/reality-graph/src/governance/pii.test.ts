import { describe, it, expect } from 'vitest'
import { scanForPII, sensitivityFromPII } from './pii'

describe('scanForPII', () => {
  it('finds an email', () => {
    expect(scanForPII('contact guest at jane.doe@example.com please')).toEqual(['email'])
  })
  it('finds an international phone', () => {
    expect(scanForPII('call +44 20 7946 0958 to confirm')).toContain('phone')
  })
  it('finds a grouped domestic phone', () => {
    expect(scanForPII('reach us on 020 7946 0958')).toContain('phone')
  })
  it('finds a Luhn-valid card but ignores a random long number', () => {
    expect(scanForPII('card 4242 4242 4242 4242 on file')).toContain('credit_card')
    expect(scanForPII('order number 1234567890123456')).not.toContain('credit_card')
  })
  it('finds an IBAN', () => {
    expect(scanForPII('pay to GB82WEST12345698765432')).toContain('iban')
  })
  it('returns empty for clean text', () => {
    expect(scanForPII('12 cases of tomatoes delivered on tuesday')).toEqual([])
  })
  it('is stable across repeat calls (no lastIndex drift)', () => {
    const t = 'email a@b.com'
    expect(scanForPII(t)).toEqual(scanForPII(t))
  })
})

describe('sensitivityFromPII', () => {
  it('leaves the base when nothing is found', () => {
    expect(sensitivityFromPII([], 'internal')).toBe('internal')
    expect(sensitivityFromPII([], 'public')).toBe('public')
  })
  it('raises contact data to confidential', () => {
    expect(sensitivityFromPII(['email'])).toBe('confidential')
    expect(sensitivityFromPII(['phone'])).toBe('confidential')
  })
  it('raises financial data to restricted', () => {
    expect(sensitivityFromPII(['credit_card'])).toBe('restricted')
    expect(sensitivityFromPII(['iban', 'email'])).toBe('restricted')
  })
  it('never lowers an already-higher base', () => {
    expect(sensitivityFromPII(['email'], 'restricted')).toBe('restricted')
  })
})
