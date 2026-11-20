'use server'

import { revalidatePath } from 'next/cache'
import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'
import type { ActionState } from '@/app/admin/action-state'
import { readUuid } from '@/app/admin/form-values'
import { requireAdmin } from '@/lib/auth/require-admin'
import { syncPositions } from '@/lib/quotes/positions'
import { isGroupDisplay, presentationOrder, type GroupSetting } from '@/lib/quotes/presentation'
import { listQuoteItems } from '@/lib/quotes/queries'

export type { ActionState }

/**
 * How a quote is presented: the groups it is printed in, their order, and how
 * much of each the client sees (src/lib/quotes/presentation.ts).
 *
 * Every one of these is a draft-only write, and the database is what says so:
 * quote_groups_guard_status and quote_items_guard_status refuse the statement
 * on a quote that has left draft (0019, 0009). This module turns that refusal
 * into a sentence.
 */

const INVALID_QUOTE = 'El presupuesto no es válido.'

function describeError(error: PostgrestError): string {
  if (error.code === 'P0001') {
    if (error.message.includes('1 to 80')) return 'El nombre del grupo debe tener entre 1 y 80 caracteres.'
    return 'Este presupuesto ya no es un borrador: su presentación está congelada. Vuelve a borrador para cambiarla.'
  }
  if (error.code === '42501') return 'No tienes permiso para hacer esto.'
  console.error('quote presentation write failed', error)
  return 'No se pudo guardar el cambio. Inténtalo de nuevo.'
}

/** A group name from a form: '' is the ungrouped lines (null); otherwise 1-80 characters. */
function readGroup(formData: FormData, field: string): { ok: true; value: string | null } | { ok: false } {
  const raw = formData.get(field)
  if (typeof raw !== 'string') return { ok: false }
  const trimmed = raw.trim()
  if (trimmed === '') return { ok: true, value: null }
  if (trimmed.length > 80) return { ok: false }
  return { ok: true, value: trimmed }
}

function readNewName(formData: FormData, field: string): string | null {
  const raw = formData.get(field)
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  return trimmed.length >= 1 && trimmed.length <= 80 ? trimmed : null
}

function revalidate(quoteId: string): void {
  revalidatePath(`/admin/quotes/${quoteId}`)
}

/**
 * Gives every group the quote currently has a settings row, numbered in the
 * order the document prints them now.
 *
 * Run before any change of order or display: a row with a position is how a
 * group keeps its place, and a group without one would otherwise jump to the
 * end the first time its neighbour was moved.
 *
 * It only ever ADDS rows (as detailed, with nothing to overwrite) and moves
 * positions. It never rewrites a display and never deletes a row: this runs
 * read-then-write, and a second tab acting in between must not be able to turn
 * a hidden group back into a detailed one. A row left behind by a group that
 * no longer has lines is harmless -- nothing reads settings for absent groups.
 */
async function settleGroups(
  supabase: SupabaseClient,
  quoteId: string,
): Promise<{ error: PostgrestError | null; names: string[] }> {
  const lines = await listQuoteItems(supabase, quoteId)
  const { data: current, error: readError } = await supabase
    .from('quote_groups')
    .select('name, position, display')
    .eq('quote_id', quoteId)
  if (readError) return { error: readError, names: [] }

  const settings = (current ?? []) as GroupSetting[]
  const ordered = presentationOrder(
    [...lines].sort((a, b) => a.position - b.position || a.createdAt.localeCompare(b.createdAt)),
    settings,
  )
  const names: string[] = []
  for (const line of ordered) {
    if (line.groupName !== null && !names.includes(line.groupName)) names.push(line.groupName)
  }
  if (names.length === 0) return { error: null, names }

  const known = new Set(settings.map((row) => row.name))
  const missing = names.filter((name) => !known.has(name))
  if (missing.length > 0) {
    const { error } = await supabase.from('quote_groups').upsert(
      missing.map((name) => ({ quote_id: quoteId, name, position: 0, display: 'detailed' })),
      { onConflict: 'quote_id,name', ignoreDuplicates: true },
    )
    if (error) return { error, names }
  }

  const placed = new Map(settings.map((row) => [row.name, row.position]))
  for (const [index, name] of names.entries()) {
    if (placed.get(name) === index + 1) continue
    const { error } = await supabase
      .from('quote_groups')
      .update({ position: index + 1 })
      .eq('quote_id', quoteId)
      .eq('name', name)
    if (error) return { error, names }
  }
  return { error: null, names }
}

/** Detailed, without prices, or only the total: what the client sees of one group. */
export async function setGroupDisplay(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = await requireAdmin()

  const quoteId = readUuid(formData, 'quote_id')
  if (quoteId === null) return { error: INVALID_QUOTE }
  const name = readNewName(formData, 'group_name')
  if (name === null) return { error: 'Ponle nombre al grupo antes de elegir cómo se ve.' }
  const display = formData.get('display')
  if (!isGroupDisplay(display)) return { error: 'Esa forma de mostrar el grupo no existe.' }

  const settled = await settleGroups(supabase, quoteId)
  if (settled.error) return { error: describeError(settled.error) }

  const { error } = await supabase
    .from('quote_groups')
    .update({ display })
    .eq('quote_id', quoteId)
    .eq('name', name)
  if (error) return { error: describeError(error) }

  revalidate(quoteId)
  return { error: null }
}

/** One place up or down in the document. */
export async function moveGroup(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = await requireAdmin()

  const quoteId = readUuid(formData, 'quote_id')
  if (quoteId === null) return { error: INVALID_QUOTE }
  const name = readNewName(formData, 'group_name')
  if (name === null) return { error: 'Ponle nombre al grupo antes de moverlo.' }
  const direction = formData.get('direction')
  if (direction !== 'up' && direction !== 'down') return { error: 'Esa dirección no existe.' }

  const settled = await settleGroups(supabase, quoteId)
  if (settled.error) return { error: describeError(settled.error) }

  // After settling, the live groups sit at positions 1..n in `names` order.
  const index = settled.names.indexOf(name)
  const target = direction === 'up' ? index - 1 : index + 1
  if (index === -1 || target < 0 || target >= settled.names.length) {
    return { error: null }
  }

  for (const [group, position] of [
    [name, target + 1],
    [settled.names[target]!, index + 1],
  ] as const) {
    const { error } = await supabase
      .from('quote_groups')
      .update({ position })
      .eq('quote_id', quoteId)
      .eq('name', group)
    if (error) return { error: describeError(error) }
  }

  await syncPositions(supabase, quoteId)
  revalidate(quoteId)
  return { error: null }
}

/**
 * Renames a group of this quote. Onto a name the quote already uses, the two
 * groups become one (rename_quote_group, 0019).
 */
export async function renameGroup(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = await requireAdmin()

  const quoteId = readUuid(formData, 'quote_id')
  if (quoteId === null) return { error: INVALID_QUOTE }
  const from = readGroup(formData, 'group_name')
  if (!from.ok) return { error: 'El grupo no es válido.' }
  const to = readNewName(formData, 'new_name')
  if (to === null) return { error: 'El nombre del grupo debe tener entre 1 y 80 caracteres.' }

  const { error } = await supabase.rpc('rename_quote_group', {
    p_quote_id: quoteId,
    p_from: from.value,
    p_to: to,
  })
  if (error) return { error: describeError(error) }

  const settled = await settleGroups(supabase, quoteId)
  if (settled.error) return { error: describeError(settled.error) }

  await syncPositions(supabase, quoteId)
  revalidate(quoteId)
  return { error: null }
}

/** Files one line under another group, an existing one or one named here. */
export async function moveLineToGroup(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = await requireAdmin()

  const quoteId = readUuid(formData, 'quote_id')
  const lineId = readUuid(formData, 'line_id')
  if (quoteId === null) return { error: INVALID_QUOTE }
  if (lineId === null) return { error: 'La línea no es válida.' }
  const to = readNewName(formData, 'group_name')
  if (to === null) return { error: 'El nombre del grupo debe tener entre 1 y 80 caracteres.' }

  const { error } = await supabase
    .from('quote_items')
    .update({ group_name: to })
    .eq('id', lineId)
    .eq('quote_id', quoteId)
  if (error) return { error: describeError(error) }

  // The group it left may be empty now, and the one it joined may be new: it
  // goes last, where a new group belongs until somebody places it.
  const settled = await settleGroups(supabase, quoteId)
  if (settled.error) return { error: describeError(settled.error) }

  await syncPositions(supabase, quoteId)
  revalidate(quoteId)
  return { error: null }
}
