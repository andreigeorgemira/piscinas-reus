import { roundMoney } from '@/lib/money'

// Only a comma unambiguously signals "this is a decimal separator, everything
// else is grouping" -- staff type prices the Spanish way (1.234,56), but the
// same keystrokes on an English layout mean 1.234, not 1234. With no comma
// present we cannot tell those two readings apart, so a lone dot is read as
// a decimal point. See the '1.234' test case for why that side of the
// ambiguity was chosen deliberately.
//
// Validation happens against this ANCHORED pattern on purpose: an unanchored
// regex (no ^/$) would accept '48abc' because it only needs to find a match
// somewhere in the string, not consume all of it.
const NORMALISED_NUMBER_PATTERN = /^-?\d+(\.\d+)?$/

/**
 * Parses a price typed the Spanish way ('1.234,56') into a number, or null
 * if the input cannot be a price at all.
 *
 * Returns negative numbers rather than rejecting them: whether a negative
 * price is meaningful depends on the caller (a discount line vs. a unit
 * price), so only the caller can word the rejection message.
 */
export function parseDecimal(raw: string): number | null {
  const trimmed = raw.trim()
  if (trimmed === '') {
    return null
  }

  // The only currency symbol this form ever shows staff is the euro sign, and
  // it can arrive pasted in from elsewhere. Strip it and re-trim; anything
  // else that isn't a plausible number is rejected below, not sanitised.
  const withoutCurrency = trimmed.replace(/€/g, '').trim()
  if (withoutCurrency === '') {
    return null
  }

  let normalised: string
  if (withoutCurrency.includes(',')) {
    // A comma is present, so it is THE decimal separator: every dot is
    // thousands grouping and gets discarded before the comma is swapped in.
    //
    // Note: replace(',', '.') below replaces only the FIRST comma. That is
    // intentional, not a bug worked around elsewhere -- a second comma (e.g.
    // '48,00,00') must survive normalisation as '48.00,00' and get caught by
    // the anchored pattern check, rather than being silently stripped.
    normalised = withoutCurrency.replace(/\./g, '').replace(',', '.')
  } else {
    // No comma: a dot, if present, is already the decimal separator.
    normalised = withoutCurrency
  }

  if (!NORMALISED_NUMBER_PATTERN.test(normalised)) {
    return null
  }

  return Number(normalised)
}

/**
 * True when `value` has a third decimal (or more) that rounding to money
 * precision would change. The caller is expected to REJECT such a value,
 * not silently round it: rounding is quieter but dishonest here, because the
 * number typed would not be the number charged and nothing on screen would
 * say so.
 */
export function hasMoreThanTwoDecimals(value: number): boolean {
  return roundMoney(value) !== value
}

// Grouping is off on purpose. ICU versions disagree about whether a
// four-digit amount groups ('1.234,50' vs '1234,50'), so leaving grouping on
// would make this format -- and the tests pinning it -- version-dependent
// for no real benefit at the amounts this business deals in.
const MONEY_FORMATTER = new Intl.NumberFormat('es-ES', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  useGrouping: false,
})

/**
 * Formats a number as a Spanish-style money string, e.g. 1234.5 -> '1234,50'.
 */
export function formatMoney(value: number): string {
  return MONEY_FORMATTER.format(value)
}
