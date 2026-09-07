/**
 * Rounds a monetary amount to two decimals, half away from zero.
 *
 * `Math.round` is not enough on its own: 1.005 is stored as 1.00499...,
 * so it would round down and lose a cent. Shifting through the exponent
 * notation avoids that representation error.
 */
export function roundMoney(value: number): number {
  if (!Number.isFinite(value)) {
    throw new TypeError(`roundMoney expects a finite number, received ${value}`)
  }
  const sign = value < 0 ? -1 : 1
  const shifted = Number(`${Math.abs(value)}e2`)
  return (sign * Number(`${Math.round(shifted)}e-2`)) || 0
}
