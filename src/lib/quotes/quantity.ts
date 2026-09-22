import { formatMoney } from '@/lib/price-book/decimal'

/**
 * Quantities are not money, and this module exists because of the one place
 * they differ: `quote_items.quantity` is numeric(12,3) where every price in
 * the schema is numeric(12,2) (supabase/migrations/0001_core_schema.sql).
 *
 * Three decimals are not decoration. Tiling is quoted in square metres to the
 * millimetre of a cut, and 12,125 m2 is a real measurement a staff member
 * reads off a plan. Rounding it to 12,13 the way a price is rounded changes
 * the figure the client is charged.
 *
 * Parsing is `parseDecimal` from the price-book module, unchanged: a quantity
 * is typed with the same keyboard and the same Spanish comma as a price, and
 * two parsers for one notation is how the two drift apart.
 */
export const QUANTITY_DECIMALS = 3

/** Rounds to the three decimals the column holds, half away from zero. */
export function roundQuantity(value: number): number {
  if (!Number.isFinite(value)) {
    throw new TypeError(`roundQuantity expects a finite number, received ${value}`)
  }
  const sign = value < 0 ? -1 : 1
  const shifted = Number(`${Math.abs(value)}e3`)
  return (sign * Number(`${Math.round(shifted)}e-3`)) || 0
}

/**
 * True when the value carries a fourth decimal the column would silently
 * drop. Callers reject rather than round, for the same reason prices do
 * (src/lib/price-book/decimal.ts): the number typed would not be the number
 * charged, and nothing on screen would say so.
 */
export function hasMoreThanThreeDecimals(value: number): boolean {
  return roundQuantity(value) !== value
}

/**
 * A quantity as a table shows it: Spanish notation, trailing zeros gone.
 *
 * '2' rather than '2,000' matters here in a way it does not for money. A
 * price column is a column of amounts and reads best aligned to the cent; a
 * quantity column holds 1 unit beside 12,125 m2, and padding the 1 to '1,000'
 * makes every whole number look like a measurement somebody took.
 */
export function formatQuantity(value: number): string {
  const rounded = roundQuantity(value)
  const sign = rounded < 0 ? '-' : ''
  const absolute = Math.abs(rounded)

  const whole = Math.trunc(absolute)
  // Built from the money formatter so the thousands grouping is defined in
  // exactly one place, then given back its own fraction.
  const grouped = formatMoney(whole).slice(0, -3)

  const fraction = absolute.toFixed(QUANTITY_DECIMALS).split('.')[1]!.replace(/0+$/, '')

  return fraction === '' ? `${sign}${grouped}` : `${sign}${grouped},${fraction}`
}
