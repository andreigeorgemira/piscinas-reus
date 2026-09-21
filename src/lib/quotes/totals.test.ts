import { describe, expect, it } from 'vitest'
import { lineCost, lineTotal } from './totals'

describe('lineTotal', () => {
  it('multiplies quantity by price', () => {
    expect(lineTotal({ quantity: 12, unitPrice: 32.5, discountPct: 0 })).toBe(390)
  })

  it('applies the discount as a percentage', () => {
    expect(lineTotal({ quantity: 10, unitPrice: 100, discountPct: 10 })).toBe(900)
    expect(lineTotal({ quantity: 1, unitPrice: 48, discountPct: 100 })).toBe(0)
  })

  it('rounds the line, not the product of the sum', () => {
    // 12.125 * 32.5 = 394.0625. Two decimals, half away from zero: 394,06.
    // The same rounding public.quote_item_total does in
    // supabase/migrations/0005_quote_totals.sql, so the screen and the view
    // cannot disagree by a cent.
    expect(lineTotal({ quantity: 12.125, unitPrice: 32.5, discountPct: 0 })).toBe(394.06)
  })

  it('rounds a discounted line the same way', () => {
    // 3 * 19.99 * 0.925 = 55.47225
    expect(lineTotal({ quantity: 3, unitPrice: 19.99, discountPct: 7.5 })).toBe(55.47)
  })

  it('is zero for a line not measured yet', () => {
    expect(lineTotal({ quantity: 0, unitPrice: 32.5, discountPct: 0 })).toBe(0)
  })
})

describe('lineCost', () => {
  it('multiplies quantity by cost and ignores the discount', () => {
    // A discount is something the company gives away, not something the
    // material stops costing.
    expect(lineCost({ quantity: 12.125, unitCost: 18.4 })).toBe(223.1)
  })
})
