import { describe, expect, it } from 'vitest'
import { formatQuantity, hasMoreThanThreeDecimals, roundQuantity } from './quantity'

describe('roundQuantity', () => {
  it('keeps three decimals', () => {
    expect(roundQuantity(12.125)).toBe(12.125)
  })

  it('rounds a fourth decimal half away from zero', () => {
    expect(roundQuantity(12.1255)).toBe(12.126)
    expect(roundQuantity(-12.1255)).toBe(-12.126)
  })

  it('never answers with negative zero', () => {
    // '-0' in a quantity column reads as a typo rather than as a number.
    expect(roundQuantity(-0.0001)).toBe(0)
    expect(Object.is(roundQuantity(-0.0001), -0)).toBe(false)
  })

  it('refuses a value that is not a finite number', () => {
    expect(() => roundQuantity(Number.NaN)).toThrow(TypeError)
  })
})

describe('hasMoreThanThreeDecimals', () => {
  it('accepts the three the column holds', () => {
    expect(hasMoreThanThreeDecimals(12.125)).toBe(false)
    expect(hasMoreThanThreeDecimals(1)).toBe(false)
  })

  it('catches a fourth', () => {
    expect(hasMoreThanThreeDecimals(12.1251)).toBe(true)
  })
})

describe('formatQuantity', () => {
  it('drops the decimals a whole number does not need', () => {
    expect(formatQuantity(1)).toBe('1')
    expect(formatQuantity(24)).toBe('24')
  })

  it('keeps only the decimals that carry information', () => {
    expect(formatQuantity(2.5)).toBe('2,5')
    expect(formatQuantity(12.125)).toBe('12,125')
    expect(formatQuantity(12.1)).toBe('12,1')
  })

  it('groups thousands the Spanish way', () => {
    expect(formatQuantity(1234)).toBe('1.234')
    expect(formatQuantity(1234.125)).toBe('1.234,125')
  })

  it('formats zero and negatives', () => {
    expect(formatQuantity(0)).toBe('0')
    expect(formatQuantity(-2.5)).toBe('-2,5')
  })

  it('rounds before formatting rather than truncating', () => {
    expect(formatQuantity(12.1255)).toBe('12,126')
  })
})
