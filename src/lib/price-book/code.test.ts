import { describe, expect, it } from 'vitest'
import { suggestCode } from './code'

const estructura = ['EST-001', 'EST-002', 'EST-010']
const book = [...estructura, 'EXC-001', 'EXC-002', 'CLI-004']

describe('suggestCode', () => {
  it('takes the destination prefix and the next number free in the book', () => {
    expect(suggestCode('EXC-001', estructura, book)).toBe('EST-011')
  })

  it('counts numbers across the whole book, not only the destination group', () => {
    // EST-012 sits in another group; the code is unique per book.
    expect(suggestCode('EXC-001', estructura, [...book, 'EST-012'])).toBe('EST-013')
  })

  it('keeps the width the prefix already uses', () => {
    expect(suggestCode('EXC-001', ['SEG-1', 'SEG-2'], ['SEG-1', 'SEG-2'])).toBe('SEG-3')
    expect(suggestCode('EXC-001', ['SEG-0007'], ['SEG-0007'])).toBe('SEG-0008')
  })

  it('learns the prefix from what most of the group shares', () => {
    // One stray CLI moved in earlier does not redefine the group.
    expect(suggestCode('ACC-003', ['EXC-001', 'EXC-002', 'CLI-004'], book)).toBe('EXC-003')
  })

  it('breaks a tie between prefixes the same way every time', () => {
    expect(suggestCode('ACC-001', ['SEG-001', 'DEP-001'], ['SEG-001', 'DEP-001'])).toBe('DEP-002')
  })

  it('offers nothing for a concept without a code', () => {
    expect(suggestCode(null, estructura, book)).toBeNull()
  })

  it('offers nothing when the destination has no coded concepts to learn from', () => {
    expect(suggestCode('EXC-001', [], book)).toBeNull()
    expect(suggestCode('EXC-001', ['sin número'], book)).toBeNull()
  })

  it('offers nothing when the code already carries the destination prefix', () => {
    expect(suggestCode('EST-004', estructura, book)).toBeNull()
  })

  it('offers a code to replace a free-form one', () => {
    expect(suggestCode('bomba grande', estructura, book)).toBe('EST-011')
  })

  it('ignores codes with no prefix before the number', () => {
    expect(suggestCode('EXC-001', ['001', '002'], ['001', '002'])).toBeNull()
  })

  it('offers nothing the column would refuse', () => {
    const long = `${'X'.repeat(37)}-01`
    expect(suggestCode('EXC-001', [long], [long, `${'X'.repeat(37)}-99`])).toBeNull()
  })
})
