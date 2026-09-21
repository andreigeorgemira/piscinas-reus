import { describe, expect, it } from 'vitest'
import { buildBoard, documentOrder, UNGROUPED_SECTION, type BoardBook } from './board'
import type { QuoteItem } from './queries'

const book: BoardBook = {
  groups: [
    {
      id: 'g-tierras',
      name: 'Movimiento de tierras',
      position: 1,
      concepts: [
        { id: 'c-exc', code: 'EXC-001', name: 'Excavación vaso piscina', description: null, unit: 'm2', unitCost: 28, unitPrice: 48 },
        { id: 'c-zanja', code: 'EXC-005', name: 'Zanja de instalaciones', description: null, unit: 'ml', unitCost: 9, unitPrice: 18 },
      ],
    },
    {
      id: 'g-rev',
      name: 'Revestimiento',
      position: 2,
      concepts: [
        { id: 'c-gresite', code: 'REV-001', name: 'Gresite 2,5x2,5', description: null, unit: 'm2', unitCost: 18, unitPrice: 32.5 },
      ],
    },
  ],
}

let clock = 0

function line(overrides: Partial<QuoteItem> = {}): QuoteItem {
  clock += 1
  return {
    id: `l-${clock}`,
    priceBookItemId: null,
    groupName: null,
    name: 'Línea',
    description: null,
    unit: 'unit',
    quantity: 1,
    unitCost: 0,
    unitPrice: 100,
    discountPct: 0,
    isRecommended: false,
    clientSelected: false,
    position: 0,
    createdAt: `2026-09-21T10:00:0${clock}Z`,
    ...overrides,
  }
}

describe('the board', () => {
  it('offers every concept of the book, chosen or not', () => {
    const board = buildBoard(book, [])

    expect(board.sections.map((section) => section.name)).toEqual([
      'Movimiento de tierras',
      'Revestimiento',
    ])
    expect(board.sections[0]!.rows).toHaveLength(2)
    expect(board.sections[0]!.rows[0]).toMatchObject({ kind: 'concept', line: null })
    expect(board.lineCount).toBe(0)
  })

  it('hangs a line on the concept it came from', () => {
    const gresite = line({ priceBookItemId: 'c-gresite', name: 'Gresite 2,5x2,5', quantity: 74, unitPrice: 32.5 })
    const board = buildBoard(book, [gresite])

    const section = board.sections.find((s) => s.name === 'Revestimiento')!
    expect(section.rows[0]).toMatchObject({ kind: 'concept', line: { id: gresite.id } })
    // 74 × 32,50 = 2.405,00
    expect(section.subtotal).toBe(2405)
    expect(board.lineCount).toBe(1)
  })

  it('puts a second line for the same concept right under the first', () => {
    // Two areas of the same gresite at two prices: the case a checkbox alone
    // cannot express, and the reason `extra` rows exist.
    const first = line({ priceBookItemId: 'c-gresite', name: 'Gresite 2,5x2,5', quantity: 74 })
    const second = line({ priceBookItemId: 'c-gresite', name: 'Gresite 2,5x2,5 (escalera)', quantity: 6 })
    const board = buildBoard(book, [second, first])

    const rows = board.sections.find((s) => s.name === 'Revestimiento')!.rows
    // The older line owns the checkbox whatever order they arrived in.
    expect(rows[0]).toMatchObject({ kind: 'concept', line: { id: first.id } })
    expect(rows[1]).toMatchObject({ kind: 'extra', line: { id: second.id } })
  })

  it('files a free line inside its own group, after the concepts', () => {
    const free = line({ groupName: 'Movimiento de tierras', name: 'Desvío de riego existente' })
    const board = buildBoard(book, [free])

    const rows = board.sections.find((s) => s.name === 'Movimiento de tierras')!.rows
    expect(rows).toHaveLength(3)
    expect(rows[2]).toMatchObject({ kind: 'loose', line: { id: free.id } })
  })

  it('keeps a line from another book on screen, in a section of its own', () => {
    // It must not vanish when the book selector changes: a line that
    // disappears reads as deleted.
    const other = line({ priceBookItemId: 'c-from-other-book', groupName: 'Mantenimiento', name: 'Limpieza de arqueta' })
    const board = buildBoard(book, [other])

    const section = board.sections.find((s) => s.name === 'Mantenimiento')!
    expect(section.fromBook).toBe(false)
    expect(section.conceptCount).toBe(0)
    expect(section.rows).toEqual([{ kind: 'loose', line: other }])
  })

  it('files a line with no group under "Sin grupo", last', () => {
    const board = buildBoard(book, [
      line({ groupName: 'Mantenimiento', name: 'Limpieza' }),
      line({ name: 'Algo sin grupo' }),
    ])

    expect(board.sections.map((s) => s.name)).toEqual([
      'Movimiento de tierras',
      'Revestimiento',
      'Mantenimiento',
      UNGROUPED_SECTION,
    ])
  })

  it('leaves an optional extra out of its section subtotal', () => {
    const board = buildBoard(book, [
      line({ priceBookItemId: 'c-gresite', quantity: 10, unitPrice: 30 }),
      line({ priceBookItemId: 'c-gresite', quantity: 1, unitPrice: 500, isRecommended: true }),
    ])

    const section = board.sections.find((s) => s.name === 'Revestimiento')!
    expect(section.lineCount).toBe(2)
    expect(section.subtotal).toBe(300)
  })

  it('applies a discount the way the database does', () => {
    const board = buildBoard(book, [
      line({ priceBookItemId: 'c-exc', groupName: 'Movimiento de tierras', quantity: 10, unitPrice: 100, discountPct: 10 }),
    ])

    expect(board.sections[0]!.subtotal).toBe(900)
  })
})

describe('searching the board', () => {
  it('narrows to the concepts that match, and drops the empty sections', () => {
    const board = buildBoard(book, [], { search: 'gresite' })

    expect(board.sections).toHaveLength(1)
    expect(board.sections[0]!.name).toBe('Revestimiento')
  })

  it('matches a code as well as a name', () => {
    const board = buildBoard(book, [], { search: 'exc-005' })

    expect(board.sections[0]!.rows).toHaveLength(1)
    expect(board.sections[0]!.rows[0]).toMatchObject({ concept: { code: 'EXC-005' } })
  })

  it('matches a free line by its name', () => {
    const free = line({ groupName: 'Movimiento de tierras', name: 'Desvío de riego' })
    const board = buildBoard(book, [free], { search: 'riego' })

    expect(board.sections).toHaveLength(1)
    expect(board.sections[0]!.rows).toEqual([{ kind: 'loose', line: free }])
  })
})

describe('showing only what the quote uses', () => {
  it('drops every concept the quote does not use, and keeps its lines', () => {
    const chosen = line({ priceBookItemId: 'c-gresite', name: 'Gresite 2,5x2,5' })
    const free = line({ groupName: 'Movimiento de tierras', name: 'Desvío de riego' })
    const board = buildBoard(book, [chosen, free], { onlyChosen: true })

    expect(board.sections.map((s) => s.name)).toEqual(['Movimiento de tierras', 'Revestimiento'])
    expect(board.sections[0]!.rows).toEqual([{ kind: 'loose', line: free }])
    expect(board.sections[1]!.rows).toHaveLength(1)
    expect(board.lineCount).toBe(2)
  })
})

describe('documentOrder', () => {
  it('is the book order, with the lines the book cannot place last', () => {
    const gresite = line({ priceBookItemId: 'c-gresite', name: 'Gresite' })
    const copy = line({ priceBookItemId: 'c-gresite', name: 'Gresite escalera' })
    const excavacion = line({ priceBookItemId: 'c-exc', name: 'Excavación' })
    const free = line({ groupName: 'Movimiento de tierras', name: 'Desvío de riego' })
    const other = line({ groupName: 'Mantenimiento', name: 'Limpieza' })

    const board = buildBoard(book, [other, copy, free, gresite, excavacion])

    // Movimiento de tierras (excavación, then its free line), Revestimiento
    // (gresite, then its copy), then the group this book does not have. That is
    // what the PDF prints and what `position` is set to.
    expect(documentOrder(board)).toEqual([
      excavacion.id,
      free.id,
      gresite.id,
      copy.id,
      other.id,
    ])
  })

  it('counts lines and the sections holding them', () => {
    const board = buildBoard(book, [
      line({ priceBookItemId: 'c-gresite' }),
      line({ groupName: 'Mantenimiento', name: 'Limpieza' }),
    ])

    expect(board.lineCount).toBe(2)
    expect(board.sectionsWithLines).toBe(2)
    expect(board.conceptCount).toBe(3)
  })
})
