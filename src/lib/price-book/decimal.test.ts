import { describe, expect, it } from 'vitest'
import { formatEuros, formatMoney, hasMoreThanTwoDecimals, parseDecimal } from './decimal'

describe('parseDecimal', () => {
  it('parses a comma as the decimal separator', () => {
    expect(parseDecimal('48,00')).toBe(48)
    expect(parseDecimal('32,5')).toBe(32.5)
  })

  it('parses a dot as the decimal separator when there is no comma', () => {
    expect(parseDecimal('48.00')).toBe(48)
  })

  it('treats every dot as thousands grouping once a comma is present', () => {
    expect(parseDecimal('1.234,56')).toBe(1234.56)
    expect(parseDecimal('12.345.678,90')).toBe(12345678.9)
  })

  it('parses a plain integer', () => {
    expect(parseDecimal('1234')).toBe(1234)
  })

  it('reads dots that split the digits into threes as thousands grouping, the way every screen prints them', () => {
    // Every figure in the app is printed Spanish-style ('1.234,56 €'), so a dot
    // followed by exactly three digits is what staff type for thousands. Reading
    // '2.000' as 2 was seen in the browser: a 2.000 € price saved as 2,00 €,
    // silently. A wrong small number does NOT get caught by eye -- 2,00 € sat on a
    // 40.000 € quote and only the client's total gave it away.
    expect(parseDecimal('2.000')).toBe(2000)
    expect(parseDecimal('1.234')).toBe(1234)
    expect(parseDecimal('12.345.678')).toBe(12345678)
    expect(parseDecimal('-1.500')).toBe(-1500)
  })

  it('still reads a dot as a decimal point when it is not grouping digits in threes', () => {
    expect(parseDecimal('1.5')).toBe(1.5)
    expect(parseDecimal('48.75')).toBe(48.75)
    expect(parseDecimal('0.125')).toBe(0.125)
    expect(parseDecimal('1234.5')).toBe(1234.5)
  })

  it('rejects dots that look like grouping but are not', () => {
    expect(parseDecimal('1.23.456')).toBeNull()
    expect(parseDecimal('1234.567.890')).toBeNull()
  })

  it('trims surrounding whitespace and a trailing euro sign', () => {
    expect(parseDecimal(' 48,00 € ')).toBe(48)
  })

  it('rejects empty and blank input', () => {
    expect(parseDecimal('')).toBeNull()
    expect(parseDecimal('   ')).toBeNull()
  })

  it('rejects non-numeric input', () => {
    expect(parseDecimal('abc')).toBeNull()
  })

  it('rejects a number with trailing garbage instead of partially matching it', () => {
    // Proves the validation regex is anchored (^...$), not just matched somewhere in
    // the string -- an unanchored pattern would find '48' inside '48abc' and accept it.
    expect(parseDecimal('48abc')).toBeNull()
  })

  it('rejects a euro sign anywhere other than trailing', () => {
    // Only a TRAILING '€' (see the ' 48,00 € ' case above) is stripped as a pasted-in
    // currency symbol. A euro sign in any other position -- leading, or embedded
    // between digits -- is not a formatting quirk to sanitise away; it is malformed
    // input and must be rejected, not silently dropped from the middle of the number.
    expect(parseDecimal('€48,00')).toBeNull()
    expect(parseDecimal('4€8,00')).toBeNull()
  })

  it('rejects a second comma even though replace() only swaps the first one', () => {
    // String.prototype.replace(',', '.') replaces only the first occurrence, so a
    // naive normalisation of '48,00,00' would produce '48.00,00' and silently look
    // like a valid number. The anchored validation regex must still catch that
    // leftover comma rather than truncating or ignoring it.
    expect(parseDecimal('48,00,00')).toBeNull()
  })

  it('rejects internal whitespace', () => {
    expect(parseDecimal('4 8')).toBeNull()
  })

  it('rejects a malformed sign', () => {
    expect(parseDecimal('--48')).toBeNull()
  })

  it('parses negative numbers -- rejecting them is the caller\'s job, not this function\'s', () => {
    expect(parseDecimal('-5')).toBe(-5)
  })
})

describe('hasMoreThanTwoDecimals', () => {
  it('is true when rounding to two decimals would change the value', () => {
    expect(hasMoreThanTwoDecimals(48.555)).toBe(true)
  })

  it('is false when the value already has at most two decimals', () => {
    expect(hasMoreThanTwoDecimals(48.55)).toBe(false)
  })
})

describe('formatMoney', () => {
  it('formats a whole number with two decimals and a comma separator', () => {
    expect(formatMoney(48)).toBe('48,00')
  })

  it('groups thousands with a dot', () => {
    expect(formatMoney(1234.5)).toBe('1.234,50')
  })

  it('groups every three digits, not just the first thousand', () => {
    expect(formatMoney(1234567.5)).toBe('1.234.567,50')
  })

  it('leaves a three-digit amount ungrouped', () => {
    expect(formatMoney(999.99)).toBe('999,99')
  })

  it('groups a four-digit amount, whatever ICU would have done', () => {
    // Spanish sets minimumGroupingDigits to 2, so Intl.NumberFormat renders
    // this as '1234,00' on some builds. The company reads '1.000,00'.
    expect(formatMoney(1000)).toBe('1.000,00')
  })

  it('keeps the sign in front of the grouped amount', () => {
    expect(formatMoney(-1234.5)).toBe('-1.234,50')
  })

  it('never renders a negative zero', () => {
    expect(formatMoney(-0)).toBe('0,00')
  })

  it('rounds to two decimals rather than truncating', () => {
    expect(formatMoney(1234.567)).toBe('1.234,57')
  })

  it('round-trips through parseDecimal', () => {
    expect(parseDecimal(formatMoney(1234567.89))).toBe(1234567.89)
  })
})

describe('formatEuros', () => {
  it('appends the symbol after a non-breaking space', () => {
    expect(formatEuros(1234.5)).toBe('1.234,50\u00a0€')
  })

  it('is still readable by parseDecimal', () => {
    // The form strips a trailing euro sign, so a pasted price survives.
    expect(parseDecimal(formatEuros(1234.5))).toBe(1234.5)
  })
})
