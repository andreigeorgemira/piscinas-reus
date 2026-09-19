/**
 * The code a concept would take in the group it has just been moved to.
 *
 * Groups carry no prefix of their own: the convention lives in the codes
 * (EXC-001, EXC-002... in "Movimiento de tierras"). So the prefix is read off
 * the concepts already in the destination -- the one most of them share --
 * and the number is the next one free across the whole book, because codes
 * are unique per book, not per group. The width follows the codes already
 * using that prefix, so EST-9 is never offered next to EST-010.
 *
 * Returns null when there is nothing sensible to offer: the concept has no
 * code, the destination has no coded concepts to learn a prefix from, or the
 * code already carries that prefix.
 */
export function suggestCode(
  code: string | null,
  groupCodes: readonly string[],
  bookCodes: readonly string[],
): string | null {
  if (code === null) return null

  const prefix = dominantPrefix(groupCodes)
  if (prefix === null) return null

  const current = parseCode(code)
  if (current?.prefix === prefix) return null

  let highest = 0
  let width = 1
  for (const other of bookCodes) {
    const parsed = parseCode(other)
    if (parsed?.prefix !== prefix) continue
    highest = Math.max(highest, parsed.number)
    width = Math.max(width, parsed.digits)
  }

  const suggestion = `${prefix}${String(highest + 1).padStart(width, '0')}`
  // The column's own limit (schema.ts): an offer the save would refuse is no offer.
  return suggestion.length <= 40 ? suggestion : null
}

type ParsedCode = { prefix: string; number: number; digits: number }

/** "EXC-007" -> EXC- / 7 / 3. A code without a prefix before its number is no convention. */
function parseCode(code: string): ParsedCode | null {
  const [, prefix, digits] = /^(.*\D)(\d+)$/.exec(code) ?? []
  if (prefix === undefined || digits === undefined) return null
  return { prefix, number: Number(digits), digits: digits.length }
}

/** The prefix most of these codes share; ties go to the first alphabetically, so the offer is stable. */
function dominantPrefix(codes: readonly string[]): string | null {
  const counts = new Map<string, number>()
  for (const code of codes) {
    const parsed = parseCode(code)
    if (parsed) counts.set(parsed.prefix, (counts.get(parsed.prefix) ?? 0) + 1)
  }

  let best: string | null = null
  let bestCount = 0
  for (const [prefix, count] of counts) {
    if (count > bestCount || (count === bestCount && best !== null && prefix < best)) {
      best = prefix
      bestCount = count
    }
  }
  return best
}
