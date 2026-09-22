import { describe, expect, it } from 'vitest'
import { buildOrderingBook, type OrderingConcept } from './ordering'

function concept(overrides: Partial<OrderingConcept> & { id: string }): OrderingConcept {
  return {
    code: null,
    name: 'Concepto',
    unit: 'unit',
    groupName: 'Grupo',
    groupPosition: 1,
    bookPosition: 1,
    ...overrides,
  }
}

describe('the book that ranks a quote', () => {
  it('orders groups by their own book, then by their own position', () => {
    const book = buildOrderingBook([
      concept({ id: 'a', groupName: 'Mantenimiento', groupPosition: 1, bookPosition: 2 }),
      concept({ id: 'b', groupName: 'Estructura', groupPosition: 2, bookPosition: 1 }),
      concept({ id: 'c', groupName: 'Movimiento de tierras', groupPosition: 1, bookPosition: 1 }),
    ])

    expect(book.groups.map((group) => group.name)).toEqual([
      'Movimiento de tierras',
      'Estructura',
      'Mantenimiento',
    ])
  })

  it('keeps a group name that two books share in one section, at its best rank', () => {
    // Otherwise the printed document splits "Mantenimiento" in two, one half
    // per book, which is not a thing anybody asked for.
    const book = buildOrderingBook([
      concept({ id: 'a', groupName: 'Mantenimiento', groupPosition: 4, bookPosition: 2 }),
      concept({ id: 'b', groupName: 'Mantenimiento', groupPosition: 1, bookPosition: 1 }),
      concept({ id: 'c', groupName: 'Estructura', groupPosition: 9, bookPosition: 1 }),
    ])

    expect(book.groups.map((group) => group.name)).toEqual(['Mantenimiento', 'Estructura'])
    expect(book.groups[0]!.concepts.map((c) => c.id).sort()).toEqual(['a', 'b'])
  })

  it('orders concepts by code, and puts the codeless ones after', () => {
    const book = buildOrderingBook([
      concept({ id: 'z', code: null, name: 'Sin código' }),
      concept({ id: 'b', code: 'EXC-002' }),
      concept({ id: 'a', code: 'EXC-001' }),
    ])

    expect(book.groups[0]!.concepts.map((c) => c.id)).toEqual(['a', 'b', 'z'])
  })
})
