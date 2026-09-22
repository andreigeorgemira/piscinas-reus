'use server'

import { revalidatePath } from 'next/cache'
import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'
import type { ActionState } from '@/app/admin/action-state'
import { readUuid } from '@/app/admin/form-values'
import { requireAdmin } from '@/lib/auth/require-admin'
import type { UnitType } from '@/lib/price-book/schema'
import { buildBoard, documentOrder } from '@/lib/quotes/board'
import { buildOrderingBook, type OrderingConcept } from '@/lib/quotes/ordering'
import { listQuoteItems } from '@/lib/quotes/queries'
import {
  firstIssue,
  quoteItemInputFromForm,
  quoteItemInputSchema,
  quoteItemInputToRow,
} from '@/lib/quotes/schema'

export type { ActionState }

const INVALID_LINE = 'La línea no es válida.'
const INVALID_QUOTE = 'El presupuesto no es válido.'

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

/**
 * A refusal from the database, in words that say what to do.
 *
 * P0001 on a line is almost always one thing: quote_items_guard_status
 * (0009_quote_immutability.sql) refusing to touch a line whose quote has left
 * 'draft'. It can happen without the screen being wrong -- a second tab sent
 * the quote while this one still showed the editor -- so it is a sentence, not
 * a crash, and it names the way out.
 */
function describeWriteError(error: PostgrestError): string {
  switch (error.code) {
    case 'P0001':
      return 'Este presupuesto ya no es un borrador: sus líneas están congeladas. Vuelve a borrador para editarlo.'
    case '23514':
      return 'Algún número está fuera de rango.'
    case '42501':
      return 'No tienes permiso para hacer esto.'
    default:
      console.error('quote line write failed', error)
      return 'No se pudo guardar la línea. Inténtalo de nuevo.'
  }
}

function revalidateQuote(quoteId: string): void {
  revalidatePath(`/admin/quotes/${quoteId}`)
  // The list prints the total of every quote on it.
  revalidatePath('/admin/quotes')
}

type ConceptRow = {
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
async function readConcepts(
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
 * group, and the lines a book cannot place last.
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
async function syncPositions(supabase: SupabaseClient, quoteId: string): Promise<void> {
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

    const order = documentOrder(buildBoard(buildOrderingBook(concepts), lines))
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

/**
 * Ticks or unticks a concept of the catalogue.
 *
 * Ticking writes one line, copying every descriptive and monetary field, so
 * editing or retiring the concept afterwards cannot rewrite a quote (spec,
 * section 7). The concept is read here rather than trusted from the form: the
 * browser knows the price it was showing, but a POST can claim any price.
 *
 * Unticking removes EVERY line of that concept, copies included. The checkbox
 * says "this concept is in the quote", so leaving a copy behind after clearing
 * it would leave a figure on the quote the checkbox says is not there. The
 * screen asks first when there is more than one.
 */
export async function toggleConcept(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const supabase = await requireAdmin()

  const quoteId = readUuid(formData, 'quote_id')
  const conceptId = readUuid(formData, 'concept_id')
  if (quoteId === null) return { error: INVALID_QUOTE }
  if (conceptId === null) return { error: 'El concepto no es válido.' }

  const { data: existing, error: readError } = await supabase
    .from('quote_items')
    .select('id')
    .eq('quote_id', quoteId)
    .eq('price_book_item_id', conceptId)

  if (readError) {
    return { error: describeWriteError(readError) }
  }

  if ((existing as { id: string }[]).length > 0) {
    const { error } = await supabase
      .from('quote_items')
      .delete()
      .eq('quote_id', quoteId)
      .eq('price_book_item_id', conceptId)

    if (error) return { error: describeWriteError(error) }

    await syncPositions(supabase, quoteId)
    revalidateQuote(quoteId)
    return { error: null }
  }

  const concepts = await readConcepts(supabase, [conceptId])
  const concept = concepts[0]
  if (!concept) {
    return { error: 'Ese concepto ya no está en el tarifario.' }
  }

  const { error } = await supabase.from('quote_items').insert({
    quote_id: quoteId,
    price_book_item_id: concept.id,
    group_name: concept.price_book_groups?.name ?? null,
    name: concept.name,
    description: concept.description,
    unit: concept.unit,
    // One unit, because a line with no quantity reads as a line nobody
    // finished. Staff type over it immediately.
    quantity: 1,
    unit_cost: concept.unit_cost,
    unit_price: concept.unit_price,
    is_recommended: formData.get('is_recommended') === 'on',
    position: 0,
  })

  if (error) {
    return { error: describeWriteError(error) }
  }

  await syncPositions(supabase, quoteId)
  revalidateQuote(quoteId)
  return { error: null }
}

/**
 * A second line for a concept already on the quote.
 *
 * Two areas of the same gresite at two prices is the case a checkbox cannot
 * express, and this is the way out of it. The copy keeps `price_book_item_id`,
 * so it stays under its concept on screen and in the printed order, and its
 * name becomes editable text like a free line's -- "Gresite 2,5x2,5" twice in a
 * row on a PDF tells the client nothing, and the second one is usually "gresite
 * de la escalera".
 */
export async function duplicateLine(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const supabase = await requireAdmin()

  const id = readUuid(formData, 'id')
  const quoteId = readUuid(formData, 'quote_id')
  if (id === null) return { error: INVALID_LINE }
  if (quoteId === null) return { error: INVALID_QUOTE }

  const { data: line, error: readError } = await supabase
    .from('quote_items')
    .select(
      'price_book_item_id, group_name, name, description, unit, quantity, unit_cost, unit_price, discount_pct, is_recommended',
    )
    .eq('id', id)
    .eq('quote_id', quoteId)
    .maybeSingle()

  if (readError) return { error: describeWriteError(readError) }
  if (!line) return { error: INVALID_LINE }

  const { error } = await supabase
    .from('quote_items')
    .insert({ ...(line as Record<string, unknown>), quote_id: quoteId, position: 0 })

  if (error) return { error: describeWriteError(error) }

  await syncPositions(supabase, quoteId)
  revalidateQuote(quoteId)
  return { error: null }
}

/**
 * A line of this quote and nobody else's catalogue, filed inside a group.
 *
 * The group is what makes this worth doing: the PDF and the public link print
 * the quote segmented by group, so a one-off "desvío de riego existente"
 * belongs under "Movimiento de tierras" rather than in a bag of loose lines at
 * the end of the document.
 */
export async function addSectionLine(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const supabase = await requireAdmin()

  const quoteId = readUuid(formData, 'quote_id')
  if (quoteId === null) return { error: INVALID_QUOTE }

  const parsed = quoteItemInputSchema.safeParse(quoteItemInputFromForm(formData))
  if (!parsed.success) {
    return { error: firstIssue(parsed.error) }
  }

  const rawGroup = formData.get('group_name')
  const groupName = typeof rawGroup === 'string' ? rawGroup.trim().slice(0, 80) : ''

  const { error } = await supabase.from('quote_items').insert({
    quote_id: quoteId,
    ...quoteItemInputToRow(parsed.data),
    // '' becomes null, never an empty string: a line with no group is filed
    // under "Sin grupo" by the board, and '' would be a second name for that.
    group_name: groupName === '' ? null : groupName,
    position: 0,
  })

  if (error) {
    return { error: describeWriteError(error) }
  }

  await syncPositions(supabase, quoteId)
  revalidateQuote(quoteId)
  return { error: null }
}

/**
 * One line's own fields: what a row posts when a number in it changes.
 *
 * The whole row is posted, not the one field that changed, and that is what the
 * hidden inputs in the row are for: an update that wrote only the quantity
 * would still have to read the rest to validate it, and a form that leaves a
 * checkbox out clears it (an unchecked box posts nothing at all).
 */
export async function updateLine(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const supabase = await requireAdmin()

  const id = readUuid(formData, 'id')
  const quoteId = readUuid(formData, 'quote_id')
  if (id === null) return { error: INVALID_LINE }
  if (quoteId === null) return { error: INVALID_QUOTE }

  const parsed = quoteItemInputSchema.safeParse(quoteItemInputFromForm(formData))
  if (!parsed.success) {
    return { error: firstIssue(parsed.error) }
  }

  const { error } = await supabase
    .from('quote_items')
    .update(quoteItemInputToRow(parsed.data))
    // Both ids, so a line id from one quote cannot be edited through another
    // quote's screen. RLS already limits this to staff; this limits it to the
    // quote the form was rendered for.
    .eq('id', id)
    .eq('quote_id', quoteId)

  if (error) {
    return { error: describeWriteError(error) }
  }

  revalidateQuote(quoteId)
  return { error: null }
}

/**
 * Whether a line counts towards the price or hangs off it as an optional extra.
 *
 * Its own action rather than a field of the row's form: it is one click, and
 * sending the whole row through validation to flip one boolean would mean a
 * half-typed quantity in the same row could refuse the click.
 */
export async function setLineKind(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const supabase = await requireAdmin()

  const id = readUuid(formData, 'id')
  const quoteId = readUuid(formData, 'quote_id')
  if (id === null) return { error: INVALID_LINE }
  if (quoteId === null) return { error: INVALID_QUOTE }

  const kind = formData.get('kind')
  if (kind !== 'base' && kind !== 'optional') {
    return { error: 'Ese tipo de línea no existe.' }
  }

  const { error } = await supabase
    .from('quote_items')
    .update({ is_recommended: kind === 'optional' })
    .eq('id', id)
    .eq('quote_id', quoteId)

  if (error) {
    return { error: describeWriteError(error) }
  }

  revalidateQuote(quoteId)
  return { error: null }
}

export async function deleteLine(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const supabase = await requireAdmin()

  const id = readUuid(formData, 'id')
  const quoteId = readUuid(formData, 'quote_id')
  if (id === null) return { error: INVALID_LINE }
  if (quoteId === null) return { error: INVALID_QUOTE }

  const { error } = await supabase
    .from('quote_items')
    .delete()
    .eq('id', id)
    .eq('quote_id', quoteId)

  if (error) {
    return { error: describeWriteError(error) }
  }

  await syncPositions(supabase, quoteId)
  revalidateQuote(quoteId)
  return { error: null }
}
