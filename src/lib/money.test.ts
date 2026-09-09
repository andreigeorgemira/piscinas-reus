import { describe, expect, it } from 'vitest'
import { roundMoney } from './money'

describe('roundMoney', () => {
  it('rounds to two decimals', () => {
    expect(roundMoney(10.234)).toBe(10.23)
    expect(roundMoney(10.235)).toBe(10.24)
  })

  it('rounds half away from zero, not to even', () => {
    expect(roundMoney(0.125)).toBe(0.13)
    expect(roundMoney(0.135)).toBe(0.14)
  })

  it('survives binary floating point representation', () => {
    expect(roundMoney(1.005)).toBe(1.01)
    expect(roundMoney(8.615)).toBe(8.62)
  })

  it('handles negatives symmetrically', () => {
    expect(roundMoney(-10.235)).toBe(-10.24)
  })

  it('returns zero unchanged', () => {
    expect(roundMoney(0)).toBe(0)
  })
})
