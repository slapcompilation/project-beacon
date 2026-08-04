import { describe, it, expect } from 'vitest'
import { checkEntityName, isNameableEntity } from './entityNames'

describe('checkEntityName', () => {
  it('refuses exactly what the first real contract produced', () => {
    // Live findings from the ΗΛΙΑΚΤΙΔΑ supply contract, 2026-08-04.
    expect(checkEntityName('supplier').reason).toBe('category-word')
    expect(checkEntityName('food product').reason).toBe('generic-type')
    expect(checkEntityName('frozen product').reason).toBe('generic-type')
    expect(checkEntityName('bakery product').reason).toBe('generic-type')
    expect(checkEntityName('Item 1').reason).toBe('positional')
    expect(checkEntityName('Item 2').reason).toBe('positional')
  })

  it('keeps the names that identify one thing', () => {
    // Including the real supplier, in Greek — nothing here is language-specific.
    for (const name of ['ΗΛΙΑΚΤΙΔΑ', 'Orange Juice', 'Lime', 'Premium Spirits Co',
                        'Clause 7.2', 'Tequila Blanco', 'Valinor']) {
      expect(isNameableEntity(name), name).toBe(true)
    }
  })

  it('refuses positions, deictics and bare numbers', () => {
    expect(checkEntityName('line 2').reason).toBe('positional')
    expect(checkEntityName('#4').reason).toBe('numeric')
    expect(checkEntityName('the above').reason).toBe('deictic')
    expect(checkEntityName('7.2').reason).toBe('numeric')
    expect(checkEntityName('x').reason).toBe('too-short')
  })

  it('does not over-reach into real names that contain a category word', () => {
    // "Supplier" alone is a category; "Rivendell Provisions Ltd" is a company,
    // and a company whose name contains "Supplies" is still a company.
    expect(isNameableEntity('Rivendell Provisions Ltd')).toBe(true)
    expect(isNameableEntity('Athens Food Supplies SA')).toBe(true)
    expect(isNameableEntity('Contract 2/2023')).toBe(true)
  })
})
