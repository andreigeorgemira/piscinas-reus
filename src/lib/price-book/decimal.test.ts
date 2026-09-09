import { describe, expect, it } from 'vitest'
import { formatMoney, hasMoreThanTwoDecimals, parseDecimal } from './decimal'

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

  it('reads a lone dot as a decimal point, not thousands grouping, when there is no comma', () => {
    // '1.234' is ambiguous: it could mean one thousand two hundred thirty-four, or
    // one point two three four. With no comma present there is no signal that the
    // dot is grouping rather than decimal, so we read it the way the same keystrokes
    // read on an English keyboard: 1.234. This is deliberate, not an oversight -- a
    // wrong SMALL number is caught by eye when a staff member reviews the quote;
    // a wrong LARGE number (1234 instead of 1.234) looks plausible and slips through.
    expect(parseDecimal('1.234')).toBe(1.234)
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

  it('formats without thousands grouping', () => {
    expect(formatMoney(1234.5)).toBe('1234,50')
  })
})
