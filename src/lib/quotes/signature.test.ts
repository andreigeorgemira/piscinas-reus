import { describe, expect, it } from 'vitest'
import { isPngDataUrl } from './signature'

/** A real 1×1 PNG, the smallest thing that is one. */
const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

describe('isPngDataUrl', () => {
  it('accepts what a canvas produces', () => {
    expect(isPngDataUrl(PNG)).toBe(true)
  })

  it('refuses nothing at all', () => {
    expect(isPngDataUrl(null)).toBe(false)
    expect(isPngDataUrl('')).toBe(false)
  })

  it('refuses another format wearing the prefix', () => {
    // This is the case that hangs @react-pdf rather than failing: the prefix is
    // right and the bytes are not a PNG.
    const gif = 'data:image/png;base64,R0lGODlhAQABAAAAACw='
    expect(isPngDataUrl(gif)).toBe(false)
  })

  it('refuses one that is nothing but a header', () => {
    // The magic bytes alone are not an image, and a canvas never produces
    // anything this short: a real signature is thousands of characters.
    expect(isPngDataUrl('data:image/png;base64,iVBORw0KGgo=')).toBe(false)
    expect(isPngDataUrl('data:image/png;base64,iVBO')).toBe(false)
  })

  it('refuses something too big to be a signature', () => {
    const huge = `data:image/png;base64,${'A'.repeat(400_000)}`
    expect(isPngDataUrl(huge)).toBe(false)
  })

  it('refuses a url that is not a data url', () => {
    expect(isPngDataUrl('https://example.test/firma.png')).toBe(false)
  })
})
