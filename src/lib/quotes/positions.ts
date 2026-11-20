import type { SupabaseClient } from '@supabase/supabase-js'
import type { UnitType } from '@/lib/price-book/schema'
import { buildBoard, documentOrder } from './board'
import { buildOrderingBook, type OrderingConcept } from './ordering'
import { presentationOrder, type GroupSetting } from './presentation'
import { listQuoteItems } from './queries'

/**
 * Reading concepts for a quote, and keeping `quote_items.position` in the order
 * the document prints. Server-only, and deliberately NOT in a 'use server'
 * file: everything a 'use server' module exports becomes an endpoint anyone
 * can POST to.
 */

/**
 * How many concept ids travel in one `.in()` filter.
 *
 * PostgREST takes the filter in the query string, and a long enough list is a
 * 414 -- measured on this project's own gateway at around 250 ids of 20
 * characters (see the note in .superpowers/sdd/2026-09-09-price-book). A quote
 * with more than 200 distinct concepts is not a quote anybody writes, but the
 * loop costs three lines and removes the ceiling.
 */
const CONCEPT_CHUNK = 200

export type ConceptRow = {
  id: string
  code: string | null
  name: string
  description: string | null
  unit: UnitType
  unit_cost: number
  unit_price: number
  price_book_groups: { name: string; position: number } | null
  price_books: { position: number } | null
}

const CONCEPT_SELECT =
  'id, code, name, description, unit, unit_cost, unit_price, price_book_groups(name, position), price_books(position)'

/** Reads concepts by id, in chunks the query string can carry. */
export async function readConcepts(
  supabase: SupabaseClient,
  ids: string[],
): Promise<ConceptRow[]> {
  const rows: ConceptRow[] = []

  for (let start = 0; start < ids.length; start += CONCEPT_CHUNK) {
    const { data, error } = await supabase
      .from('price_book_items')
      .select(CONCEPT_SELECT)
      .in('id', ids.slice(start, start + CONCEPT_CHUNK))

    if (error) throw error
    // An embedded to-one resource: PostgREST answers with an object, while
    // supabase-js has no generated types to know that (same cast as
    // src/lib/quotes/queries.ts).
    rows.push(...(data as unknown as ConceptRow[]))
  }

  return rows
}

/**
 * Rewrites `quote_items.position` so the stored order is the order the document
 * prints: groups as their own book ranks them, concepts by code inside each
 * group, and the lines a book cannot place last -- then regrouped the way staff
 * arranged the presentation (src/lib/quotes/presentation.ts): placed groups in
 * their order, every group's lines together.
 *
 * Run after every change that adds or removes a line. The client's page and the
 * PDF order by `position` alone and know nothing about a price book, so if this
 * did not run they would print the order the lines happened to be written in --
 * which is exactly what the single-table editor asks staff to stop thinking
 * about (src/lib/quotes/board.ts).
 *
 * Its failures are logged and swallowed: a quote whose lines are right but
 * whose numbering is stale is worth far more than a refused edit, and the next
 * change repairs it.
 */
export async function syncPositions(supabase: SupabaseClient, quoteId: string): Promise<void> {
  try {
    const lines = await listQuoteItems(supabase, quoteId)
    if (lines.length === 0) return

    const conceptIds = Array.from(
      new Set(lines.map((line) => line.priceBookItemId).filter((id): id is string => id !== null)),
    )

    const concepts: OrderingConcept[] = (await readConcepts(supabase, conceptIds)).map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      unit: row.unit,
      groupName: row.price_book_groups?.name ?? 'Sin grupo',
      groupPosition: row.price_book_groups?.position ?? Number.MAX_SAFE_INTEGER,
      bookPosition: row.price_books?.position ?? Number.MAX_SAFE_INTEGER,
    }))

    const { data: settings, error: settingsError } = await supabase
      .from('quote_groups')
      .select('name, position, display')
      .eq('quote_id', quoteId)
    if (settingsError) throw settingsError

    const byId = new Map(lines.map((line) => [line.id, line]))
    const catalogueOrder = documentOrder(buildBoard(buildOrderingBook(concepts), lines))
      .map((id) => byId.get(id))
      .filter((line) => line !== undefined)
    const order = presentationOrder(catalogueOrder, (settings ?? []) as GroupSetting[]).map((line) => line.id)
    const current = new Map(lines.map((line) => [line.id, line.position]))

    for (const [index, id] of order.entries()) {
      const position = index + 1
      if (current.get(id) === position) continue
      const { error } = await supabase
        .from('quote_items')
        .update({ position })
        .eq('id', id)
        .eq('quote_id', quoteId)
      if (error) throw error
    }
  } catch (error) {
    console.error('could not renumber the quote lines', error)
  }
}

