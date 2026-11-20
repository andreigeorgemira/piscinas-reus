import { describe, expect, it } from 'vitest'
import { formatVatRate, vatChoiceLabel, vatRateField } from './vat'

describe('vatRateField', () => {
  it('reads "none" and an empty value as no VAT', () => {
    expect(vatRateField.parse('none')).toBeNull()
    expect(vatRateField.parse('')).toBeNull()
    expect(vatRateField.parse(null)).toBeNull()
  })

  it('reads a percentage', () => {
    expect(vatRateField.parse('21')).toBe(21)
    expect(vatRateField.parse('10,5')).toBe(10.5)
    expect(vatRateField.parse('0')).toBe(0)
    // Typed the way people write it.
    expect(vatRateField.parse('7,5 %')).toBe(7.5)
    expect(vatRateField.parse(' 21% ')).toBe(21)
  })

  it('refuses a rate outside 0-100 or with three decimals', () => {
    expect(vatRateField.safeParse('101').success).toBe(false)
    expect(vatRateField.safeParse('-1').success).toBe(false)
    expect(vatRateField.safeParse('21,125').success).toBe(false)
    expect(vatRateField.safeParse('abc').success).toBe(false)
  })
})

describe('labels', () => {
  it('names the Spanish rates and the absence of VAT', () => {
    expect(vatChoiceLabel(21)).toBe('IVA 21 % (general)')
    expect(vatChoiceLabel(null)).toBe('Sin IVA (IVA no incluido)')
    expect(vatChoiceLabel(7.5)).toBe('IVA 7,5\u00a0%')
  })

  it('writes a rate the Spanish way', () => {
    expect(formatVatRate(21)).toBe('21\u00a0%')
    expect(formatVatRate(10.5)).toBe('10,5\u00a0%')
  })
})
