import type { UnitType } from '@/lib/price-book/schema'
import type { QuoteItem } from './queries'
import { lineTotal } from './totals'

/**
 * The editor's screen model: one table that is the price book and the quote at
 * the same time.
 *
 * The decision behind it (taken 2026-09-21 from the mockups at
 * https://claude.ai/artifact/Nxr6smH7HE1qXXrcVsYxfx): staff do not want to
 * search for a concept and then find it again on a second list. They want the
 * catalogue on screen, a checkbox per concept, and the quantity in the same
 * row. So the editor renders every concept of one price book, grouped, and a
 * ticked concept IS a quote line.
 *
 * Three consequences this module has to hold, because they are what makes that
 * model survive a real quote:
 *
 * 1. The same concept can appear twice (two areas of gresite at two prices).
 *    Extra lines for one concept ride directly under the row that owns the
 *    checkbox, and the checkbox means "this concept is in the quote", so
 *    clearing it takes all of them.
 * 2. A quote carries lines the selected book knows nothing about: free lines
 *    written by hand, and lines added from ANOTHER book. They are not dropped
 *    from the screen -- a line that disappears looks deleted. They sit in
 *    their own group, in a section marked as not belonging to this book.
 * 3. Order is the catalogue's, not the mouse's. Groups in the book's own
 *    order, concepts by code inside each group, and the lines the book does
 *    not know last. That order is the order of the PDF and of the public link
 *    (the whole reason free lines are filed inside a group), which is why
 *    `documentOrder` exists: the database keeps `position` in step with it.
 */

/** A concept of the selected book, as the board needs it. */
export type BoardConcept = {
  id: string
  code: string | null
  name: string
  description: string | null
  unit: UnitType
  unitCost: number
  unitPrice: number
}

/** One group of the selected book, with its concepts in catalogue order. */
export type BoardBookGroup = {
  id: string | null
  name: string
  position: number
  concepts: BoardConcept[]
}

/** The catalogue of one price book: what the screen offers to tick. */
export type BoardBook = { groups: BoardBookGroup[] }

/**
 * A row of the table.
 *
 * `concept` rows carry the checkbox: they exist whether or not the quote uses
 * them, and hold the line when it does. `extra` rows are a second (third…)
 * line for that same concept. `loose` rows are lines the book cannot explain:
 * free lines, and lines from another book.
 */
export type BoardRow =
  | { kind: 'concept'; concept: BoardConcept; line: QuoteItem | null }
  | { kind: 'extra'; concept: BoardConcept; line: QuoteItem }
  | { kind: 'loose'; line: QuoteItem }

export type BoardSection = {
  /** Stable key for React and for the fold state: the group id, or its name. */
  key: string
  name: string
  /** False for a group this book does not have: another book's, or renamed. */
  fromBook: boolean
  rows: BoardRow[]
  /** Lines in this section, copies included. */
  lineCount: number
  /** Concepts the book offers here. Zero for a section that is only lines. */
  conceptCount: number
  /** What this section adds to the quote's base, optional extras excluded. */
  subtotal: number
}

export type Board = {
  sections: BoardSection[]
  lineCount: number
  /** Sections holding at least one line, for the "x líneas en y grupos" line. */
  sectionsWithLines: number
  conceptCount: number
}

/** The name a line with no group is filed under, on screen and on the PDF. */
export const UNGROUPED_SECTION = 'Sin grupo'

/**
 * Oldest first, and never by `position`: position is the OUTPUT of this module
 * (documentOrder writes it), so ordering by it would make the order depend on
 * the last order. `createdAt` is the one fact about a line that never moves,
 * with the id as a tiebreaker for two lines written in the same millisecond.
 */
function byAge(a: QuoteItem, b: QuoteItem): number {
  return a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)
}

/**
 * Builds the table from one book's catalogue and the quote's own lines.
 *
 * `search` filters concepts by code and name, and lines by name. A section
 * with nothing left is dropped; with `onlyChosen`, so is every concept the
 * quote does not use -- that is the switch that turns this screen back into a
 * plain quote.
 */
export function buildBoard(
  book: BoardBook,
  lines: QuoteItem[],
  options: { search?: string | null; onlyChosen?: boolean } = {},
): Board {
  const search = (options.search ?? '').trim().toLowerCase()
  const onlyChosen = options.onlyChosen === true

  const matchesText = (...fields: (string | null)[]): boolean =>
    search === '' || fields.some((field) => (field ?? '').toLowerCase().includes(search))

  // Lines grouped by the concept they came from, oldest first: the oldest owns
  // the checkbox and the rest are its copies.
  const byConcept = new Map<string, QuoteItem[]>()
  const loose: QuoteItem[] = []

  const conceptIds = new Set<string>()
  for (const group of book.groups) {
    for (const concept of group.concepts) conceptIds.add(concept.id)
  }

  for (const line of lines) {
    if (line.priceBookItemId !== null && conceptIds.has(line.priceBookItemId)) {
      const bucket = byConcept.get(line.priceBookItemId)
      if (bucket) bucket.push(line)
      else byConcept.set(line.priceBookItemId, [line])
      continue
    }
    loose.push(line)
  }

  for (const bucket of byConcept.values()) bucket.sort(byAge)

  const sections: BoardSection[] = []
  const used = new Set<string>()

  for (const group of book.groups) {
    const rows: BoardRow[] = []

    for (const concept of group.concepts) {
      const bucket = byConcept.get(concept.id) ?? []
      const chosen = bucket.length > 0

      if (onlyChosen && !chosen) continue
      if (!matchesText(concept.code, concept.name, chosen ? bucket[0]!.name : null)) continue

      rows.push({ kind: 'concept', concept, line: bucket[0] ?? null })
      for (const extra of bucket.slice(1)) {
        rows.push({ kind: 'extra', concept, line: extra })
      }
    }

    // A line filed under this group's name that the book cannot place: a free
    // line, or one written from another book whose group happens to share the
    // name. It belongs here, at the end, because that is where the PDF prints
    // it.
    const here = loose.filter((line) => (line.groupName ?? UNGROUPED_SECTION) === group.name)
    for (const line of here.sort(byAge)) {
      used.add(line.id)
      if (!matchesText(line.name)) continue
      rows.push({ kind: 'loose', line })
    }

    if (rows.length === 0) continue

    sections.push(finishSection(group.id ?? group.name, group.name, true, rows, group.concepts.length))
  }

  // Everything the book has no group for, alphabetically, with "Sin grupo"
  // last: it is not a group anyone chose.
  const orphanNames = new Set<string>()
  for (const line of loose) {
    if (used.has(line.id)) continue
    orphanNames.add(line.groupName ?? UNGROUPED_SECTION)
  }

  const ordered = Array.from(orphanNames).sort((a, b) => {
    if (a === UNGROUPED_SECTION) return 1
    if (b === UNGROUPED_SECTION) return -1
    return a.localeCompare(b, 'es')
  })

  for (const name of ordered) {
    const rows: BoardRow[] = loose
      .filter((line) => !used.has(line.id) && (line.groupName ?? UNGROUPED_SECTION) === name)
      .sort(byAge)
      .filter((line) => matchesText(line.name))
      .map((line) => ({ kind: 'loose', line }) as BoardRow)

    if (rows.length === 0) continue
    sections.push(finishSection(name, name, false, rows, 0))
  }

  let lineCount = 0
  let sectionsWithLines = 0
  let conceptCount = 0
  for (const section of sections) {
    lineCount += section.lineCount
    conceptCount += section.conceptCount
    if (section.lineCount > 0) sectionsWithLines += 1
  }

  return { sections, lineCount, sectionsWithLines, conceptCount }
}

function finishSection(
  key: string,
  name: string,
  fromBook: boolean,
  rows: BoardRow[],
  conceptCount: number,
): BoardSection {
  let lineCount = 0
  let subtotal = 0

  for (const row of rows) {
    const line = row.line
    if (!line) continue
    lineCount += 1
    if (!line.isRecommended) subtotal += lineTotal(line)
  }

  return { key, name, fromBook, rows, lineCount, conceptCount, subtotal }
}

/**
 * The quote's lines in the order the document prints them.
 *
 * Callers write this back to `quote_items.position` after every change, which
 * is what lets the client's page and the PDF order by `position` alone without
 * knowing anything about a price book. Built from an UNFILTERED board -- a
 * search narrows the screen, never the document.
 */
export function documentOrder(board: Board): string[] {
  const ids: string[] = []
  for (const section of board.sections) {
    for (const row of section.rows) {
      if (row.line) ids.push(row.line.id)
    }
  }
  return ids
}
