import { roundMoney } from '@/lib/money'

// A comma is the decimal separator whenever there is one, and every dot is
// then grouping (1.234,56). Without a comma, dots that split the digits into
// groups of three after a non-zero lead ('2.000', '12.345.678') are grouping
// too: that is the shape every screen prints. Any other dot is a decimal point
// ('1.5', '0.125'). See the '2.000' test case for the price this cost once.
const THOUSANDS_ONLY_PATTERN = /^-?[1-9]\d{0,2}(\.\d{3})+$/

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

  // The only currency symbol this form ever shows staff is a trailing euro
  // sign, which can arrive pasted in from elsewhere (e.g. ' 48,00 € '). Only
  // that trailing position is stripped -- a stray '€' anywhere else (leading,
  // or embedded between digits) is not a formatting quirk to sanitise away,
  // it is a malformed input, and must fall through to the rejection below
  // rather than being silently dropped.
  const withoutCurrency = trimmed.replace(/\s*€\s*$/, '').trim()
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
  } else if (THOUSANDS_ONLY_PATTERN.test(withoutCurrency)) {
    // No comma, and dots that split the digits into threes: '2.000', '1.234.567'.
    // That is how every screen in the app prints a figure, so it is what staff
    // type for thousands -- and reading '2.000' as 2 saved a 2.000 € price as
    // 2,00 € without a word.
    normalised = withoutCurrency.replace(/\./g, '')
  } else {
    // No comma and no grouping: a dot, if present, is the decimal separator
    // ('1.5', '48.75', '0.125').
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

/**
 * Formats a number as a Spanish money string: dots for thousands, a comma
 * for the two decimals. 1234.5 -> '1.234,50', 1234567.5 -> '1.234.567,50'.
 *
 * Built by hand rather than with Intl.NumberFormat. ICU versions disagree
 * about whether a FOUR-digit amount groups at all -- Spanish sets
 * minimumGroupingDigits to 2, so some builds render 1234.5 as '1234,50' and
 * others as '1.234,50' -- and a price list that groups a five-digit amount
 * but not a four-digit one looks like a bug to the person reading it. The
 * rule here is the one the company asked for, it is the same on every
 * machine, and it does not depend on which ICU the server was built with.
 *
 * The output round-trips: parseDecimal reads a comma as the decimal
 * separator and discards the dots as grouping, so a price rendered into an
 * edit field comes back as the same number.
 */
export function formatMoney(value: number): string {
  const rounded = roundMoney(value)
  // `rounded < 0` and not Object.is(-0): -0 is not a debt, and '-0,00' on a
  // price list is a typo, not information.
  const sign = rounded < 0 ? '-' : ''
  const [whole, fraction] = Math.abs(rounded).toFixed(2).split('.')

  // A dot before every run of three digits that reaches the end of the
  // number. \B keeps it from landing in front of the first digit, so 123
  // stays '123' rather than becoming '.123'.
  const grouped = whole!.replace(/\B(?=(\d{3})+(?!\d))/g, '.')

  return `${sign}${grouped},${fraction}`
}

/**
 * The same amount with its unit attached: '1.234,50 €'.
 *
 * A non-breaking space before the symbol, as Spanish typography wants, and
 * so a column of prices never wraps between the number and the euro sign.
 * Screens use this; form fields use formatMoney, because parseDecimal
 * tolerates a trailing euro but a field that shows one invites typing one in
 * the middle.
 */
export function formatEuros(value: number): string {
  return `${formatMoney(value)}\u00a0€`
}

/** A percentage the Spanish way: '10 %', '7,5 %'. */
export function formatPercent(value: number): string {
  return `${String(value).replace('.', ',')} %`
}
