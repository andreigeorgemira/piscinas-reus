'use server'

import { revalidatePath } from 'next/cache'
import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'
import type { ActionState } from '@/app/admin/action-state'
import { readUuid } from '@/app/admin/form-values'
import { requireAdmin } from '@/lib/auth/require-admin'
import { searchConcepts, type ConceptMatch } from '@/lib/price-book/queries'
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

/**
 * Where a new line goes: after the last one.
 *
 * `position` is read rather than counted, because a deleted line leaves a gap
 * and counting would hand the new line a position another row already holds.
 */
async function nextPosition(supabase: SupabaseClient, quoteId: string): Promise<number> {
  const { data } = await supabase
    .from('quote_items')
    .select('position')
    .eq('quote_id', quoteId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle()

  return (data?.position ?? 0) + 1
}

/**
 * The concepts the editor's search panel offers.
 *
 * A Server Action rather than a route handler: it is called from a Client
 * Component as a plain async function, and it reaches the database through the
 * caller's own Supabase session, so RLS refuses a non-admin exactly as it does
 * everywhere else. requireAdmin is still first, so a caller who is not staff
 * gets a redirect rather than an empty list they might read as "no results".
 */
export async function searchCatalogue(
  priceBookId: string,
  search: string,
): Promise<ConceptMatch[]> {
  const supabase = await requireAdmin()

  // The id arrives from the client, so it is checked the same way a form field
  // would be: an unchecked value reaches an .eq() on a uuid column and comes
  // back as a 22P02 nobody can act on.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(priceBookId)) {
    return []
  }

  return searchConcepts(supabase, { priceBookId, search })
}

/**
 * Adds a line copied from the catalogue.
 *
 * Every descriptive and monetary field is copied, not referenced (spec,
 * section 7): the line keeps its name, unit, cost and price even if the
 * catalogue is edited, retired or deleted afterwards. `price_book_item_id`
 * stays as provenance only -- it is `on delete set null`
 * (0011_quote_item_unlink.sql), so losing the concept loses the pointer and
 * nothing else.
 *
 * The concept is read here rather than trusted from the form. The browser
 * knows the price it showed, but a POST can claim any price, and the figure on
 * a quote must be the one the catalogue holds.
 */
export async function addCatalogueLine(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const supabase = await requireAdmin()

  const quoteId = readUuid(formData, 'quote_id')
  const conceptId = readUuid(formData, 'concept_id')
  if (quoteId === null) return { error: INVALID_QUOTE }
  if (conceptId === null) return { error: 'El concepto no es válido.' }

  const { data: concept, error: readError } = await supabase
    .from('price_book_items')
    .select('id, name, description, unit, unit_cost, unit_price, price_book_groups(name)')
    .eq('id', conceptId)
    .maybeSingle()

  if (readError) {
    return { error: describeWriteError(readError) }
  }
  if (!concept) {
    return { error: 'Ese concepto ya no está en el tarifario.' }
  }

  // An embedded to-one resource: PostgREST answers with an object, while
  // supabase-js has no generated types to know that. Same cast as
  // src/lib/quotes/queries.ts.
  const row = concept as unknown as {
    id: string
    name: string
    description: string | null
    unit: string
    unit_cost: number
    unit_price: number
    price_book_groups: { name: string } | null
  }

  const { error } = await supabase.from('quote_items').insert({
    quote_id: quoteId,
    price_book_item_id: row.id,
    group_name: row.price_book_groups?.name ?? null,
    name: row.name,
    description: row.description,
    unit: row.unit,
    // One unit, because a line with no quantity reads as a line nobody
    // finished. Staff type over it immediately; zero would need typing over
    // too, and it would meanwhile sit in the total as nothing.
    quantity: 1,
    unit_cost: row.unit_cost,
    unit_price: row.unit_price,
    is_recommended: formData.get('is_recommended') === 'on',
    position: await nextPosition(supabase, quoteId),
  })

  if (error) {
    return { error: describeWriteError(error) }
  }

  revalidateQuote(quoteId)
  return { error: null }
}

/**
 * Adds a line that is not in the catalogue.
 *
 * `price_book_item_id` stays null and `group_name` too: a free line belongs to
 * no group, and the PDF prints it under the heading for ungrouped work rather
 * than inventing one.
 */
export async function addFreeLine(
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

  const { error } = await supabase.from('quote_items').insert({
    quote_id: quoteId,
    ...quoteItemInputToRow(parsed.data),
    position: await nextPosition(supabase, quoteId),
  })

  if (error) {
    return { error: describeWriteError(error) }
  }

  revalidateQuote(quoteId)
  return { error: null }
}

/** One line's own fields. The quote it belongs to never changes here. */
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

  revalidateQuote(quoteId)
  return { error: null }
}

/**
 * Moves a line one place up or down.
 *
 * Arrow buttons rather than dragging. @dnd-kit/core is in the project but its
 * sortable package is not, and the price book's drag area solves a different
 * problem (moving a concept between groups). Two buttons are also the
 * keyboard-reachable version of the same thing, which the design direction
 * asks for -- dense, keyboard-friendly, no decorative motion (spec, section
 * 12).
 *
 * It renumbers the whole quote from 1 rather than swapping two values. Lines
 * written before this screen existed can share a position (the column defaults
 * to 0), and swapping equal numbers moves nothing; renumbering repairs that on
 * the first move anybody makes.
 */
export async function moveLine(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const supabase = await requireAdmin()

  const id = readUuid(formData, 'id')
  const quoteId = readUuid(formData, 'quote_id')
  if (id === null) return { error: INVALID_LINE }
  if (quoteId === null) return { error: INVALID_QUOTE }

  const direction = formData.get('direction')
  if (direction !== 'up' && direction !== 'down') {
    return { error: 'Esa dirección no existe.' }
  }

  const { data, error: readError } = await supabase
    .from('quote_items')
    .select('id, position')
    .eq('quote_id', quoteId)
    .order('position')
    .order('created_at')

  if (readError) {
    return { error: describeWriteError(readError) }
  }

  const rows = data as { id: string; position: number }[]
  const index = rows.findIndex((row) => row.id === id)
  if (index === -1) {
    return { error: INVALID_LINE }
  }

  const target = direction === 'up' ? index - 1 : index + 1
  if (target < 0 || target >= rows.length) {
    // Already at the end it was asked to move towards. Not an error: the
    // button is hidden there, and a stale screen asking for it again should
    // simply do nothing.
    return { error: null }
  }

  const ordered = [...rows]
  const moved = ordered[index]!
  ordered[index] = ordered[target]!
  ordered[target] = moved

  for (const [offset, row] of ordered.entries()) {
    const position = offset + 1
    if (row.position === position) continue
    const { error } = await supabase
      .from('quote_items')
      .update({ position })
      .eq('id', row.id)
      .eq('quote_id', quoteId)
    if (error) {
      return { error: describeWriteError(error) }
    }
  }

  revalidateQuote(quoteId)
  return { error: null }
}
