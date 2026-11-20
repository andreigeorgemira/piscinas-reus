import { describe, expect, it } from 'vitest'
import { plural } from './plural'

describe('plural', () => {
  it('uses the singular for exactly one', () => {
    expect(plural(1, 'grupo', 'grupos')).toBe('1 grupo')
  })

  it('uses the plural for zero and for more than one', () => {
    expect(plural(0, 'línea', 'líneas')).toBe('0 líneas')
    expect(plural(3, 'extra marcado', 'extras marcados')).toBe('3 extras marcados')
  })
})
