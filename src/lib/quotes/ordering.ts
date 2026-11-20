import type { UnitType } from '@/lib/price-book/schema'
import type { BoardBook } from './board'

/**
 * How `quote_items.position` is decided.
 *
 * The editor's order is the catalogue's (see src/lib/quotes/board.ts), and that
 * order has to survive in the data: the client's page and the PDF order by
 * `position` and know nothing about a price book. So every mutation rewrites
 * the positions of the quote, using the same buildBoard/documentOrder pair the
 * screen uses.
 *
 * What this module adds is the book to feed it. It cannot be the book selected
 * on screen: a quote can hold lines from two books, and then the order of the
 * printed document would depend on which book the person happened to be looking
 * at when they last touched it. It is assembled instead from the concepts the
 * lines actually came from, ranked by their own book's position and their own
 * group's position -- a fact of the data, the same from every screen.
 */

/** A concept a quote line came from, with where it sits in its own catalogue. */
export type OrderingConcept = {
  id: string
  code: string | null
  name: string
  unit: UnitType
  groupName: string
  groupPosition: number
  bookPosition: number
}

/**
 * Builds the synthetic book that ranks a quote's own lines.
 *
 * Groups are keyed by NAME, not by id: `quote_items.group_name` is a snapshot
 * and two books can both have a "Mantenimiento". A group that appears in two
 * books takes the best rank of the two, so its lines stay together rather than
 * splitting the section in half.
 */
export function buildOrderingBook(concepts: OrderingConcept[]): BoardBook {
  const groups = new Map<string, { rank: number; concepts: OrderingConcept[] }>()

  for (const concept of concepts) {
    const rank = concept.bookPosition * 100_000 + concept.groupPosition
    const group = groups.get(concept.groupName)
    if (group) {
      group.rank = Math.min(group.rank, rank)
      group.concepts.push(concept)
      continue
    }
    groups.set(concept.groupName, { rank, concepts: [concept] })
  }

  return {
    groups: Array.from(groups.entries())
      .sort((a, b) => a[1].rank - b[1].rank || a[0].localeCompare(b[0], 'es'))
      .map(([name, group], index) => ({
        id: null,
        name,
        position: index,
        concepts: group.concepts
          // The same order listPriceBook and getBookCatalogue read a book in:
          // by code, then by name for the concepts that carry none.
          .sort((a, b) => (a.code ?? '￿').localeCompare(b.code ?? '￿') || a.name.localeCompare(b.name, 'es'))
          .map((concept) => ({
            id: concept.id,
            code: concept.code,
            name: concept.name,
            description: null,
            unit: concept.unit,
            unitCost: 0,
            unitPrice: 0,
          })),
      })),
  }
}
